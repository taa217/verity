from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import logging

from app.agent import app as agent_app
from app.tts import router as tts_router

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Lucid Teaching Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register sub-routers
app.include_router(tts_router)


# ---------------------------------------------------------------------------
# Request / helpers
# ---------------------------------------------------------------------------
class ChatRequest(BaseModel):
    message: str
    history: Optional[List[Dict[str, str]]] = []
    current_code: Optional[str] = None


def _extract_text(content) -> str:
    """Flatten LLM content (str | list of parts) to plain text."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for p in content:
            if isinstance(p, dict) and p.get("type") == "text":
                parts.append(p["text"])
            elif isinstance(p, str):
                parts.append(p)
        return "".join(parts)
    return str(content)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/")
async def root():
    return {"message": "Lucid Agent API is running"}


@app.post("/chat")
async def chat(request: ChatRequest):
    """
    Generate or fix a visual lesson.

    Returns:
        response    – human-readable summary text
        visual_state – { code, scenes? }
    """
    try:
        inputs: Dict[str, Any] = {
            "messages": [("user", request.message)],
        }

        # Seed broken code for the fix flow
        if request.current_code:
            inputs["visual_state"] = {"code": request.current_code}

        result = await agent_app.ainvoke(inputs)

        visual_state = result.get("visual_state", {})
        scenes = visual_state.get("scenes", [])

        # Build a human-readable summary from the scene narrations
        if scenes:
            narrations = [s.get("narration", "") for s in scenes if s.get("narration")]
            response_text = " ".join(narrations[:3])           # first few sentences
            if len(narrations) > 3:
                response_text += " ..."
        else:
            response_text = "I've created an animated lesson for you!"

        return {
            "response": response_text,
            "visual_state": visual_state,
        }

    except Exception as e:
        logger.error(f"Error in chat endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
