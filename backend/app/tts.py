"""
Cartesia TTS proxy — keeps the API key server-side and adds caching.

Endpoint:  POST /tts
Body:      { "text": "...", "voice_id": "..." (optional) }
Returns:   audio/wav bytes  (or 503 if Cartesia is unavailable)
"""

import hashlib
import logging
import os
from collections import OrderedDict
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
CARTESIA_API_URL = "https://api.cartesia.ai/tts/bytes"
CARTESIA_API_VERSION = "2025-04-16"
CARTESIA_MODEL = "sonic-3"
DEFAULT_VOICE_ID = "694f9389-aac1-45b6-b726-9d9369183238"  # Cartesia default
SAMPLE_RATE = 44100

# Simple LRU cache (text hash → WAV bytes).  Keeps the last N entries in
# memory so repeated narrations (e.g. scene replays) don't hit the API again.
_MAX_CACHE = 128
_cache: OrderedDict[str, bytes] = OrderedDict()

# Reusable async HTTP client (connection pooling)
_http_client: Optional[httpx.AsyncClient] = None


def _get_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(timeout=10.0)
    return _http_client


def _cache_key(text: str, voice_id: str) -> str:
    raw = f"{voice_id}::{text}"
    return hashlib.sha256(raw.encode()).hexdigest()


def _put_cache(key: str, data: bytes) -> None:
    if key in _cache:
        _cache.move_to_end(key)
        return
    _cache[key] = data
    while len(_cache) > _MAX_CACHE:
        _cache.popitem(last=False)


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------
router = APIRouter()


class TTSRequest(BaseModel):
    text: str
    voice_id: Optional[str] = None


@router.post("/tts")
async def text_to_speech(req: TTSRequest):
    """Convert text → WAV audio via Cartesia, with fallback signalling."""

    api_key = os.getenv("CARTESIA_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="Cartesia API key not configured — use browser TTS fallback.",
        )

    voice_id = req.voice_id or DEFAULT_VOICE_ID
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Empty text.")

    # Check cache first
    key = _cache_key(text, voice_id)
    if key in _cache:
        _cache.move_to_end(key)
        logger.info("TTS cache hit for: %s…", text[:40])
        return Response(content=_cache[key], media_type="audio/wav")

    # Call Cartesia
    try:
        client = _get_client()
        resp = await client.post(
            CARTESIA_API_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Cartesia-Version": CARTESIA_API_VERSION,
                "Content-Type": "application/json",
            },
            json={
                "model_id": CARTESIA_MODEL,
                "transcript": text,
                "voice": {"mode": "id", "id": voice_id},
                "output_format": {
                    "container": "wav",
                    "encoding": "pcm_s16le",
                    "sample_rate": SAMPLE_RATE,
                },
                "language": "en",
            },
        )

        if resp.status_code != 200:
            logger.warning(
                "Cartesia returned %s: %s", resp.status_code, resp.text[:200]
            )
            raise HTTPException(
                status_code=503,
                detail=f"Cartesia API error ({resp.status_code}).",
            )

        audio_bytes = resp.content
        _put_cache(key, audio_bytes)
        logger.info("TTS generated for: %s… (%d bytes)", text[:40], len(audio_bytes))

        return Response(content=audio_bytes, media_type="audio/wav")

    except httpx.HTTPError as exc:
        logger.error("Cartesia request failed: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Cartesia API unreachable — use browser TTS fallback.",
        )
