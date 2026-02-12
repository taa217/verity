import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import logging

from app.agent import app as agent_app
from app.tts import router as tts_router
from app.auth import get_current_user

load_dotenv()

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Lucid Teaching Agent")

# Allowed origins — local dev + production domain + Vercel previews
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://app.lucid-ai.co",
    "https://lucid-ai.co",
]

# Add extra origins from env (comma-separated) — useful for Vercel preview URLs
_extra = os.getenv("ALLOWED_ORIGINS", "")
if _extra:
    ALLOWED_ORIGINS.extend(o.strip() for o in _extra.split(",") if o.strip())

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",
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
async def chat(request: ChatRequest, user: dict = Depends(get_current_user)):
    """
    Generate or fix a visual lesson. Requires a valid WorkOS access token.

    Returns:
        response    – human-readable summary text
        visual_state – { code, scenes? }
    """
    try:
        logger.info(f"Chat request from user: {user.get('sub', 'unknown')}")
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
