import os
import json
from typing import Annotated, TypedDict, List, Dict, Any, Literal

from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from dotenv import load_dotenv

load_dotenv()


# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------
class AgentState(TypedDict):
    messages: Annotated[list, add_messages]
    visual_state: Dict[str, Any]       # { code, scenes }
    execution_status: Literal[
        "idle", "planning", "coding", "fixing", "modifying"
    ]
    error_log: List[str]


# ---------------------------------------------------------------------------
# Models  (stable GA releases — no flaky preview disconnects)
# ---------------------------------------------------------------------------
llm_planner = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    temperature=0.7,
    timeout=120,
    max_retries=3,
)
llm_coder = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    temperature=0.5,          # lower temp → more reliable code
    timeout=120,
    max_retries=3,
)
llm_router = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    temperature=0.0,
    timeout=30,
    max_retries=2,
)


def get_text(response) -> str:
    """Extract plain text from an LLM response (handles string / list parts)."""
    c = response.content
    if isinstance(c, str):
        return c
    if isinstance(c, list):
        parts = []
        for p in c:
            if isinstance(p, dict) and p.get("type") == "text":
                parts.append(p["text"])
            elif isinstance(p, str):
                parts.append(p)
            else:
                parts.append(str(p))
        return "".join(parts)
    return str(c)


def strip_fences(text: str) -> str:
    """Remove markdown fences and stray language labels."""
    text = text.strip()
    # Remove opening fences with optional language
    import re
    text = re.sub(r'^```[a-zA-Z]*\s*\n?', '', text)
    # Remove closing fences
    text = re.sub(r'\n?```\s*$', '', text)
    # Remove stray language labels at start
    text = re.sub(r'^(javascript|typescript|jsx|tsx|json|js|ts)\s*\n', '', text)
    return text.strip()


# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------

ROUTER_PROMPT = """You are a Router. Classify the user message into exactly one type.

Output ONLY a JSON object: {"type": "<type>"}

Types:
- "new_topic"   → user wants a NEW lesson/explanation (e.g. "Explain derivatives")
- "modification" → user wants to CHANGE the current lesson (e.g. "slow down", "add color")
- "fix_error"   → message starts with "System Error:" — a runtime bug report

Default to "new_topic" if unsure."""


LESSON_PLANNER_PROMPT = """You are a Pedagogical Architect. You design animated visual lessons that feel
like 3Blue1Brown / Manim videos.

Given a topic, produce a scene-by-scene lesson plan.

Guidelines:
- 6-10 scenes total (first scene = title/hook, last = summary/outro)
- Each scene should have a clear visual goal and exactly one key insight
- Narration should be conversational, clear, and build intuition progressively
- Duration is the MINIMUM time the scene stays on screen (3000-12000ms typically).
  The scene will also wait for narration to finish, so duration should match animation time.
  Estimate narration length: ~130 words per minute at 0.95x speed. A 30-word narration ≈ 14 seconds.
  Set duration to at LEAST match your expected narration time, or longer for complex animations.
- Visuals must be describable with SVG (paths, shapes, text, math symbols)
- Think about what ANIMATES — lines drawing, elements fading, things moving

Output ONLY valid JSON (no markdown fences):
{
  "title": "Lesson title",
  "scenes": [
    {
      "id": 1,
      "duration": 4000,
      "narration": "What the narrator says during this scene",
      "visual_description": "Detailed description of what should appear visually",
      "animation_notes": "What animates in/out, transitions, timing"
    }
  ]
}"""


LESSON_CODER_PROMPT = """You are an expert React developer who creates animated educational lessons.
You produce a single self-contained React component that plays like a video — scene-based,
with smooth animations and optional narration.

=== ALLOWED TECH (nothing else) ===
- React: useState, useEffect, useRef, useCallback, useMemo
- framer-motion: motion.*, AnimatePresence (already in scope — do NOT import)
- SVG: all standard SVG elements for graphics
- Inline styles only
- TTS functions (already in scope — do NOT import):
  * speak(text, { onEnd, onError }) — speaks with natural Cartesia AI voice, auto-falls back to browser TTS
  * cancelSpeech() — stops current speech
  * prefetchSpeech(text) — silently pre-loads audio for a single upcoming scene
  * prefetchAllScenes(narrations[]) — pre-loads ALL scene audio in parallel (call on mount!)

=== EXACT CODE PATTERN TO FOLLOW ===

function App() {
  const [currentScene, setCurrentScene] = useState(0);

  const scenes = [
    { id: 1, duration: 5000, narration: "..." },
    { id: 2, duration: 8000, narration: "..." },
  ];

  // Colors
  const c = {
    bg: "#0c0f14",
    cyan: "#00F6BB",
    purple: "#7C3AED",
    yellow: "#EAB308",
    white: "#F5F7FA",
    faint: "rgba(255,255,255,0.1)",
  };

  // Auto-start + prefetch ALL scene audio upfront for smooth playback
  useEffect(() => {
    prefetchAllScenes(scenes.map(s => s.narration));
    setCurrentScene(1);
  }, []);

  // Also prefetch next scene individually as a safety net
  useEffect(() => {
    if (currentScene === 0) return;
    const nextScene = scenes.find(s => s.id === currentScene + 1);
    if (nextScene) prefetchSpeech(nextScene.narration);
  }, [currentScene]);

  // Scene progression + narration (waits for BOTH timer AND speech to finish)
  useEffect(() => {
    if (currentScene === 0) return;
    const scene = scenes.find(s => s.id === currentScene);
    if (!scene) return;

    let speechDone = false;
    let timerDone = false;
    let cancelled = false;

    function tryAdvance() {
      if (cancelled) return;
      if (speechDone && timerDone) {
        if (currentScene < scenes.length) {
          setCurrentScene(prev => prev + 1);
        }
      }
    }

    // TTS (Cartesia AI voice with browser fallback)
    cancelSpeech();
    speak(scene.narration, {
      onEnd: () => { speechDone = true; tryAdvance(); },
      onError: () => { speechDone = true; tryAdvance(); },
    });

    // Minimum duration timer
    const timer = setTimeout(() => {
      timerDone = true;
      tryAdvance();
    }, scene.duration);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      cancelSpeech();
    };
  }, [currentScene]);

  return (
    <div style={{
      width: '100%', height: '100%', background: c.bg, color: c.white,
      position: 'relative', overflow: 'hidden',
      fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif",
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <AnimatePresence mode="wait">
        {currentScene === 1 && (
          <motion.div key="s1" exit={{ opacity: 0 }}
            style={{ width: '100%', height: '100%', position: 'relative' }}>
            {/* SVG + motion elements here */}
          </motion.div>
        )}
        {/* More scenes... */}
      </AnimatePresence>

      {/* Progress bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, height: 4,
                    background: c.faint, width: '100%' }}>
        <motion.div
          style={{ height: '100%', background: c.cyan }}
          animate={{ width: currentScene > 0
            ? (currentScene / scenes.length * 100) + '%' : '0%' }}
        />
      </div>
    </div>
  );
}

=== VISUAL STYLE ===
- Dark background (#0c0f14) — cinematic, clean
- Accent colors: Cyan #00F6BB, Purple #7C3AED, Yellow #EAB308
- White text: #F5F7FA, faint lines: rgba(255,255,255,0.1)
- Clean mathematical aesthetic (like 3Blue1Brown / Manim)
- Generous spacing, readable font sizes (24-48px for main content)

=== SVG TECHNIQUES ===
- Use viewBox="0 0 800 450" for consistent aspect ratio
- motion.path with initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} for line-drawing
- motion.circle, motion.rect for animated shapes
- SVG <text> for math / labels, or absolutely-positioned divs over SVG for richer text
- Unicode math symbols: ×, ÷, √, ∫, ∑, ∏, π, θ, Δ, ∂, ∞, ≈, ≠, ≤, ≥, ², ³
- Gradient definitions in <defs> for visual polish

=== ANIMATION TECHNIQUES ===
- Stagger children with transition={{ delay: i * 0.3 }}
- Use initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} for reveals
- Use exit={{ opacity: 0 }} on all scene containers for clean transitions
- motion.path pathLength animations for drawing effects
- Scale/rotate for emphasis: animate={{ scale: [1, 1.1, 1] }}
- Color transitions via animate={{ color: "..." }}

=== STRICT RULES ===
1. Output ONLY `function App() { ... }` — NO imports, NO exports
2. Never wrap in markdown fences. Never output "javascript" / "jsx" / "tsx" as text.
3. Every scene must have meaningful SVG visuals — NOT just centered text.
4. Include a progress bar at the bottom.
5. The component must auto-start and auto-advance through all scenes.
6. Use speak() / cancelSpeech() / prefetchSpeech() / prefetchAllScenes() for narration (already in scope).
   NEVER use window.speechSynthesis directly — always use speak() and cancelSpeech().
   CRITICAL: Scenes must wait for BOTH the duration timer AND speech to finish before advancing.
   Use the onEnd/onError callbacks in speak(text, { onEnd, onError }) — never advance on timer alone.
7. All styles must be inline objects — no CSS classes.
8. Make it visually impressive — use animations, SVG paths, gradients, motion effects.
9. Ensure proper cleanup in useEffect return functions (cancel timers, cancelSpeech()).
10. For the title scene, always include an animated SVG element (not just text).
11. CRITICAL: On mount, call prefetchAllScenes(scenes.map(s => s.narration)) to pre-load ALL audio in parallel.
    Also prefetch next scene per-scene as backup: prefetchSpeech(nextScene.narration).

Now implement this lesson plan:
"""


MODIFIER_PROMPT = """You are an expert React developer who modifies animated educational lesson components.

You receive the current lesson code and a user's modification request.
Apply ONLY the requested changes to the existing code. Do NOT rewrite the entire component from scratch.

=== MODIFICATION GUIDELINES ===
- Preserve all existing scenes, animations, and functionality unless explicitly asked to change them
- Keep the same visual style, color scheme, and layout unless asked otherwise
- If asked to "slow down": increase scene durations and add more pauses
- If asked to "speed up": decrease scene durations
- If asked to "simplify": reduce complexity, use simpler language in narrations
- If asked to "add more detail": add more scenes or expand existing narrations
- If asked about visual changes: modify colors, sizes, positions, animations as requested
- If asked a conceptual follow-up question (e.g. "what about X?", "how does Y relate?"):
  ADD new scenes that answer the question while keeping existing scenes intact,
  or replace scenes with updated content that addresses the question in context.

=== STRICT RULES ===
1. Output ONLY `function App() { ... }` — NO imports, NO exports
2. Never wrap in markdown fences. Never output "javascript" / "jsx" / "tsx" as text.
3. Every scene must have meaningful SVG visuals — NOT just centered text.
4. Only use: React hooks (useState, useEffect, useRef, useCallback, useMemo),
   framer-motion (motion.*, AnimatePresence), SVG elements, inline styles
5. TTS functions are in scope (do NOT import): speak(text, { onEnd, onError }), cancelSpeech(), prefetchSpeech(text), prefetchAllScenes(narrations[])
6. NEVER use window.speechSynthesis directly — always use speak() and cancelSpeech()
7. Scene progression must wait for BOTH the duration timer AND speech to finish.
   Use onEnd/onError callbacks in speak(text, { onEnd, onError }).
8. On mount, call prefetchAllScenes(scenes.map(s => s.narration)) to pre-load ALL audio.
9. Include a progress bar at the bottom.
10. Return the COMPLETE modified function — not just the changed parts.
"""


LESSON_FIXER_PROMPT = """You are a Code Fixer for animated React lesson components.

You will receive:
1. Code that caused an error
2. The error message

Fix the error and return ONLY the corrected function App() { ... } code.

Rules:
- NO imports, NO exports
- Only use: React hooks (useState, useEffect, useRef, useCallback, useMemo),
  framer-motion (motion.*, AnimatePresence), SVG elements, inline styles
- TTS functions are in scope (do NOT import): speak(text, { onEnd, onError }), cancelSpeech(), prefetchSpeech(text), prefetchAllScenes(narrations[])
- NEVER use window.speechSynthesis directly — always use speak() and cancelSpeech().
- CRITICAL: Scene progression must wait for BOTH the duration timer AND speech to finish.
  Use onEnd/onError callbacks in speak(text, { onEnd, onError }) — never advance on timer alone.
  Pattern: track speechDone + timerDone flags, call tryAdvance() from both callbacks.
- Never wrap in markdown fences
- Never output language labels
- Do not explain the error — just return fixed code
"""


# ---------------------------------------------------------------------------
# Graph Nodes
# ---------------------------------------------------------------------------

def router_node(state: AgentState):
    """Classify the incoming message."""
    messages = state["messages"]
    last = messages[-1]

    # Fast-path: system error messages
    if isinstance(last, HumanMessage) and str(last.content).startswith("System Error:"):
        return {"execution_status": "fixing"}

    # Only route as modification if there is existing code to modify
    has_existing_code = bool(state.get("visual_state", {}).get("code"))

    response = llm_router.invoke([
        SystemMessage(content=ROUTER_PROMPT),
        last,
    ])
    try:
        text = get_text(response)
        decision = json.loads(strip_fences(text))
        dtype = decision.get("type", "new_topic")
        if dtype == "fix_error":
            return {"execution_status": "fixing"}
        if dtype == "modification" and has_existing_code:
            return {"execution_status": "modifying"}
        return {"execution_status": "planning"}
    except Exception:
        return {"execution_status": "planning"}


def planner_node(state: AgentState):
    """Design the lesson scene-by-scene."""
    messages = state["messages"]
    response = llm_planner.invoke(
        [SystemMessage(content=LESSON_PLANNER_PROMPT)] + messages
    )
    return {"messages": [response]}


def coder_node(state: AgentState):
    """Generate, modify, or fix the React lesson component."""
    execution_status = state.get("execution_status", "coding")
    messages = state["messages"]

    # ---- Modification flow (follow-up while lesson is playing) ----
    if execution_status == "modifying":
        current_code = state.get("visual_state", {}).get("code", "")
        user_request = get_text(messages[-1]) if messages else ""

        response = llm_coder.invoke([
            SystemMessage(content=MODIFIER_PROMPT),
            HumanMessage(
                content=(
                    f"Current Code:\n{current_code}\n\n"
                    f"Modification Request: {user_request}"
                )
            ),
        ])
        code = strip_fences(get_text(response))
        return {
            "visual_state": {"code": code},
            "execution_status": "coding",
        }

    # ---- Error-fix flow ----
    if execution_status == "fixing":
        last = messages[-1]
        current_code = state.get("visual_state", {}).get("code", "")

        response = llm_coder.invoke([
            SystemMessage(content=LESSON_FIXER_PROMPT),
            HumanMessage(
                content=f"Current Code:\n{current_code}\n\nError:\n{last.content}"
            ),
        ])
        code = strip_fences(get_text(response))
        return {
            "visual_state": {"code": code},
            "execution_status": "coding",
        }

    # ---- Normal generation flow ----
    plan_text = get_text(messages[-1]) if messages else ""

    # Try to parse scenes from plan for metadata
    scenes_meta = []
    try:
        plan_data = json.loads(strip_fences(plan_text))
        scenes_meta = plan_data.get("scenes", [])
    except Exception:
        pass

    response = llm_coder.invoke([
        SystemMessage(content=LESSON_CODER_PROMPT),
        HumanMessage(content=plan_text),
    ])
    code = strip_fences(get_text(response))

    return {
        "visual_state": {
            "code": code,
            "scenes": scenes_meta,
        },
        "execution_status": "coding",
    }


# ---------------------------------------------------------------------------
# Graph Construction
# ---------------------------------------------------------------------------
workflow = StateGraph(AgentState)

workflow.add_node("router", router_node)
workflow.add_node("planner", planner_node)
workflow.add_node("coder", coder_node)

workflow.add_edge(START, "router")


def route_decision(state: AgentState) -> str:
    status = state.get("execution_status")
    if status in ("fixing", "modifying"):
        return "coder"       # skip planner — go straight to coder
    return "planner"


workflow.add_conditional_edges(
    "router",
    route_decision,
    {"coder": "coder", "planner": "planner"},
)

workflow.add_edge("planner", "coder")
workflow.add_edge("coder", END)

app = workflow.compile()
