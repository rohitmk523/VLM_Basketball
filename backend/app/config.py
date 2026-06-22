"""Settings + .env loading for the VLM_Basketball backend.

Standalone repo (research/testing). Reads backend/.env. Model presets map
flash/pro to the CURRENT Gemini ids (verified against ai.google.dev, June 2026):
  flash -> gemini-3.5-flash        (GA)
  pro   -> gemini-3.1-pro-preview  (preview)
Override either via env without code changes.
"""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# backend/app/config.py -> parents[1] == backend/
BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_DIR.parent
load_dotenv(BACKEND_DIR / ".env", override=False)
load_dotenv(REPO_ROOT / ".env", override=False)

# --- Gemini models (current ids; override via env) ---
FLASH_MODEL = os.environ.get("VLM_FLASH_MODEL", "gemini-3.5-flash")
PRO_MODEL = os.environ.get("VLM_PRO_MODEL", "gemini-3.1-pro-preview")
_PRESETS = {
    "flash": FLASH_MODEL,
    "pro": PRO_MODEL,
    "flash-3.5": "gemini-3.5-flash",
    "pro-3.1": "gemini-3.1-pro-preview",
    "flash-3": "gemini-3-flash-preview",
}

DEFAULT_FPS = float(os.environ.get("VLM_FPS", "5"))
DEFAULT_MEDIA_RES = os.environ.get("VLM_MEDIA_RESOLUTION", "medium")  # low|medium|high
DEFAULT_TEMPERATURE = float(os.environ.get("VLM_TEMPERATURE", "0.4"))
DEFAULT_MAX_OUTPUT_TOKENS = int(os.environ.get("VLM_MAX_OUTPUT_TOKENS", "8192"))

# --- Supabase (basketball project mhbrsftxvxxtfgbajrlc) ---
# Server-side, read-only. Prefer the service_role key so reads bypass RLS (the
# `games` table is RLS-protected for anon); fall back to an explicit key / anon.
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = (
    os.environ.get("SUPABASE_KEY")
    or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    or os.environ.get("SUPABASE_ANON_KEY", "")
)

# --- S3 video source ---
S3_BUCKET = os.environ.get("UBALL_VIDEO_BUCKET", "uball-videos-production")
S3_REGION = os.environ.get("AWS_DEFAULT_REGION", "us-east-1")
CLIP_CACHE = Path(os.environ.get("VLM_CLIP_CACHE", str(BACKEND_DIR / ".cache")))
# Downscale to 720p for a small, fast Gemini upload (the model downsamples anyway).
DEFAULT_VF = os.environ.get("VLM_EXTRACT_VF", "scale=-2:720")
# Prefer ranged HTTP slicing straight from S3 (presigned URL) over full download.
PREFER_REMOTE_SLICE = os.environ.get("VLM_PREFER_REMOTE_SLICE", "1") not in ("0", "false", "False")
S3_PRESIGN_TTL = int(os.environ.get("VLM_S3_PRESIGN_TTL", "3600"))
# Hard cap on a ranged remote slice (a slow link to S3 can make a short clip take
# minutes). On timeout we surface a clear error rather than downloading a multi-GB file.
REMOTE_SLICE_TIMEOUT = int(os.environ.get("VLM_REMOTE_SLICE_TIMEOUT", "240"))
# A failed ranged slice will NOT silently download the whole multi-GB angle file
# (catastrophic on a slow link). Opt in only if you're on a fast in-region link.
ALLOW_FULL_DOWNLOAD = os.environ.get("VLM_ALLOW_FULL_DOWNLOAD", "0") in ("1", "true", "True")
# Pad each side of a play's [start,end] so the clip captures build-up + outcome.
DEFAULT_CLIP_PAD = float(os.environ.get("VLM_CLIP_PAD", "3"))

# CORS origins for the Vite dev server.
CORS_ORIGINS = os.environ.get(
    "VLM_CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
).split(",")


def api_key(explicit: str | None = None) -> str:
    """Per-request key wins; else fall back to env GOOGLE_API_KEY."""
    key = (explicit or os.environ.get("GOOGLE_API_KEY", "")).strip()
    if not key:
        raise RuntimeError(
            "No Gemini API key. Enter one in the UI settings (sent as api_key / "
            "X-Goog-Api-Key) or set GOOGLE_API_KEY in backend/.env."
        )
    return key


def resolve_model(name: str | None) -> str:
    if not name:
        return FLASH_MODEL
    name = name.strip()
    return _PRESETS.get(name.lower(), name)


def require_supabase() -> None:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise RuntimeError(
            "Supabase is not configured. Set SUPABASE_URL and SUPABASE_KEY "
            "(anon or service_role for project mhbrsftxvxxtfgbajrlc) in backend/.env."
        )
