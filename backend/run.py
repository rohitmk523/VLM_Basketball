#!/usr/bin/env python3
"""Launch the VLM_Basketball backend.

  python backend/run.py               # http://127.0.0.1:8000
  python backend/run.py --port 8001

Needs backend/.env (see backend/.env.example). Install:
  python -m venv .venv && .venv/bin/pip install -r backend/requirements.txt
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.server import run  # noqa: E402

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8000)
    a = ap.parse_args()
    run(host=a.host, port=a.port)
