"""
WorkOS JWT token verification middleware.

Validates access tokens issued by WorkOS AuthKit. Uses JWKS (JSON Web Key Set)
fetched from WorkOS to verify token signatures.
"""

import os
import time
import logging
from typing import Optional

import httpx
import jwt
from fastapi import Request, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# JWKS cache
# ---------------------------------------------------------------------------
_jwks_cache: dict = {}
_jwks_cache_expiry: float = 0
JWKS_CACHE_TTL = 3600  # 1 hour

WORKOS_API_BASE = os.getenv("WORKOS_API_HOSTNAME", "https://api.workos.com")
WORKOS_CLIENT_ID = os.getenv("WORKOS_CLIENT_ID", "")
JWKS_URL = f"{WORKOS_API_BASE}/sso/jwks/{WORKOS_CLIENT_ID}"

security = HTTPBearer(auto_error=False)


async def _fetch_jwks() -> dict:
    """Fetch and cache the WorkOS JWKS."""
    global _jwks_cache, _jwks_cache_expiry

    now = time.time()
    if _jwks_cache and now < _jwks_cache_expiry:
        return _jwks_cache

    async with httpx.AsyncClient() as client:
        resp = await client.get(JWKS_URL, timeout=10)
        resp.raise_for_status()
        _jwks_cache = resp.json()
        _jwks_cache_expiry = now + JWKS_CACHE_TTL
        logger.info("Refreshed WorkOS JWKS cache")
        return _jwks_cache


async def verify_access_token(
    credentials: Optional[HTTPAuthorizationCredentials],
) -> dict:
    """
    Verify a WorkOS access token and return its decoded payload.

    Raises HTTPException(401) on invalid/missing tokens.
    """
    if not credentials:
        raise HTTPException(status_code=401, detail="Missing authorization token")

    token = credentials.credentials
    client_id = WORKOS_CLIENT_ID

    try:
        jwks_data = await _fetch_jwks()
        public_keys = {}

        for key_data in jwks_data.get("keys", []):
            kid = key_data.get("kid")
            if kid:
                public_keys[kid] = jwt.algorithms.RSAAlgorithm.from_jwk(key_data)

        # Decode header to find the right key
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")

        if kid not in public_keys:
            # Refresh JWKS in case keys were rotated
            global _jwks_cache_expiry
            _jwks_cache_expiry = 0
            jwks_data = await _fetch_jwks()
            for key_data in jwks_data.get("keys", []):
                k = key_data.get("kid")
                if k:
                    public_keys[k] = jwt.algorithms.RSAAlgorithm.from_jwk(key_data)

        rsa_key = public_keys.get(kid)
        if not rsa_key:
            raise HTTPException(status_code=401, detail="Unable to find signing key")

        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=["RS256"],
            audience=client_id if client_id else None,
            options={"verify_aud": bool(client_id)},
        )
        return payload

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid token: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")
    except httpx.HTTPError as e:
        logger.error(f"Failed to fetch JWKS: {e}")
        raise HTTPException(status_code=503, detail="Auth service unavailable")


async def get_current_user(request: Request) -> dict:
    """
    FastAPI dependency — extracts and verifies the Bearer token from the
    request Authorization header. Returns the decoded JWT payload.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization token")

    token = auth_header.split(" ", 1)[1]
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    return await verify_access_token(credentials)
