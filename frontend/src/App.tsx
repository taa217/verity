import { useState, useRef, useCallback, useEffect } from "react";
import "./App.css";

import Sidebar from "./components/Sidebar";
import HeroView from "./components/HeroView";
import ChatInput from "./components/ChatInput";
import NativeCodeRenderer from "./components/NativeCodeRenderer";
import VisualizationLoader from "./components/VisualizationLoader";
import { prefetchAllScenes, cancelAllPrefetches, cancelSpeech } from "./services/ttsService";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Message {
  role: "user" | "assistant";
  content: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const MOBILE_BREAKPOINT = 768;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => window.innerWidth <= MOBILE_BREAKPOINT,
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return isMobile;
}

// ---------------------------------------------------------------------------
// Default idle code (shown before any lesson is generated)
// ---------------------------------------------------------------------------
const IDLE_CODE = `function App() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#0c0f14', color: '#F5F7FA',
      fontFamily: "'Inter', system-ui, sans-serif",
      flexDirection: 'column', gap: 12,
    }}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{ fontSize: 20, fontWeight: 600, letterSpacing: -0.5 }}
      >
        Ready to teach
      </motion.div>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: 48 }}
        transition={{ delay: 0.3, duration: 0.8 }}
        style={{ height: 2, background: '#00F6BB', borderRadius: 1 }}
      />
    </div>
  );
}`;

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
function App() {
  const isMobile = useIsMobile();

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [code, setCode] = useState(IDLE_CODE);

  const [isLoading, setIsLoading] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [envReady, setEnvReady] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Auto-collapse sidebar on mobile
  useEffect(() => {
    setSidebarCollapsed(isMobile);
  }, [isMobile]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const isHero = !hasInteracted && messages.length === 0;
  const showOverlayLoader = isLoading || !envReady;

  const handleEnvReady = useCallback(() => setEnvReady(true), []);

  // Close sidebar when navigating on mobile
  const closeSidebarOnMobile = useCallback(() => {
    if (isMobile) setSidebarCollapsed(true);
  }, [isMobile]);

  // ---- New session — reset everything ----
  const handleNewSession = () => {
    cancelAllPrefetches();
    cancelSpeech();
    setInput("");
    setMessages([]);
    setCode(IDLE_CODE);
    setIsLoading(false);
    setShowCode(false);
    setShowChat(false);
    setHasInteracted(false);
    setEnvReady(false);
  };

  // ---- Send message ----
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input;
    setInput("");
    setHasInteracted(true);
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const res = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
      });
      const data = await res.json();

      const text =
        typeof data.response === "string"
          ? data.response
          : JSON.stringify(data.response);

      setMessages((prev) => [...prev, { role: "assistant", content: text }]);

      if (data.visual_state?.code) {
        // Prefetch ALL scene audio BEFORE rendering the lesson component.
        // This gives the TTS service a head start so audio is cached by the
        // time each scene calls speak().
        if (data.visual_state.scenes?.length) {
          const narrations = data.visual_state.scenes
            .map((s: { narration?: string }) => s.narration)
            .filter(Boolean) as string[];
          prefetchAllScenes(narrations);
        }
        setCode(data.visual_state.code);
      }
    } catch (err) {
      console.error("Backend error:", err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, something went wrong connecting to the server.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // ---- Auto-fix runtime errors ----
  const fixGuardRef = useRef(
    new Map<string, { count: number; ts: number }>(),
  );

  const handleCodeError = useCallback(
    async (error: string, brokenCode: string) => {
      if (isLoading) return;

      const sig = error.slice(0, 200);
      const now = Date.now();
      const prev = fixGuardRef.current.get(sig);
      const inWindow = prev ? now - prev.ts < 20_000 : false;
      const next = inWindow ? (prev?.count ?? 0) + 1 : 1;
      fixGuardRef.current.set(sig, { count: next, ts: now });

      if (next >= 3) {
        console.warn("Auto-fix loop detected, pausing:", sig);
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: `Same error repeating — paused auto-fix.\n\n${sig}`,
          },
        ]);
        return;
      }

      setIsLoading(true);

      try {
        const res = await fetch("http://localhost:8000/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: `System Error: ${error}`,
            current_code: brokenCode,
          }),
        });

        if (!res.ok) throw new Error("Fix request failed");

        const data = await res.json();
        if (data.visual_state?.code) {
          setCode(data.visual_state.code);
          setMessages((m) => [
            ...m,
            {
              role: "assistant",
              content: "Fixed a runtime error in the lesson.",
            },
          ]);
        }
      } catch (e) {
        console.error("Auto-fix failed:", e);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading],
  );

  // ---- Render ----
  const sidebarOpen = !sidebarCollapsed;

  return (
    <div className="app-layout">
      {/* Backdrop overlay for mobile sidebar */}
      {isMobile && sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarCollapsed(true)}
        />
      )}

      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        onNewSession={() => {
          handleNewSession();
          closeSidebarOnMobile();
        }}
      />

      <main className="main-content">
        {/* Mobile top bar with menu toggle */}
        {isMobile && (
          <div className="mobile-topbar">
            <button
              className="mobile-topbar__menu"
              onClick={() => setSidebarCollapsed(false)}
              aria-label="Open menu"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
            <div className="mobile-topbar__brand">
              <div className="mobile-topbar__logo">V</div>
              <span className="mobile-topbar__name">Verity</span>
            </div>
            <div className="mobile-topbar__spacer" />
          </div>
        )}

        {isHero ? (
          <HeroView
            input={input}
            onInputChange={setInput}
            onSend={handleSend}
            isLoading={isLoading}
          />
        ) : (
          /* ---------- Immersive lesson view ---------- */
          <div className="lesson-view">
            {/* Visual area */}
            <div className="visual-area">
              {!showOverlayLoader && (
                <div className="visual-controls">
                  <button
                    onClick={() => setShowChat(!showChat)}
                    className={showChat ? "active" : ""}
                  >
                    {showChat ? "Hide Transcript" : "Transcript"}
                  </button>
                  <button
                    onClick={() => setShowCode(!showCode)}
                    className={showCode ? "active" : ""}
                  >
                    {showCode ? "Hide Code" : "Code"}
                  </button>
                </div>
              )}

              <NativeCodeRenderer
                code={code}
                showCode={showCode}
                onCodeError={handleCodeError}
                onReady={handleEnvReady}
              />

              {showOverlayLoader && (
                <div className="visualization-loader-overlay">
                  <VisualizationLoader
                    topic={
                      messages.find((m) => m.role === "user")?.content?.slice(0, 40) ??
                      "New Lesson"
                    }
                    difficulty="intermediate"
                    onCancel={() => setIsLoading(false)}
                  />
                </div>
              )}
            </div>

            {/* Chat overlay */}
            {showChat && (
              <div className="chat-overlay">
                <div className="chat-overlay-header">
                  <span>Lesson Transcript</span>
                  <button
                    className="close-chat"
                    onClick={() => setShowChat(false)}
                  >
                    &times;
                  </button>
                </div>
                <div className="chat-messages">
                  {messages.map((msg, i) => (
                    <div key={i} className={`message-bubble ${msg.role}`}>
                      {msg.content}
                    </div>
                  ))}
                  {isLoading && (
                    <div className="message-bubble assistant">Thinking...</div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              </div>
            )}

            {/* Bottom input */}
            <div className="lesson-input">
              <ChatInput
                value={input}
                onChange={setInput}
                onSend={handleSend}
                disabled={isLoading}
                placeholder="Ask a follow-up question..."
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
