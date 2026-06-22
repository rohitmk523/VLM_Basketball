#!/usr/bin/env bash
# Dev launcher: start the FastAPI backend + Vite frontend, health-check both,
# print the frontend URL, then stream backend logs live. Ctrl+C stops everything.
#
# Usage:   ./dev.sh
# Override ports:  BACKEND_PORT=8000 FRONTEND_PORT=5173 ./dev.sh
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
VENV_PY="$ROOT/.venv/bin/python"
LOG_DIR="$ROOT/.dev-logs"
BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"

# --- colors ---
if [[ -t 1 ]]; then
  C_RST=$'\033[0m'; C_DIM=$'\033[2m'; C_GRN=$'\033[32m'; C_RED=$'\033[31m'
  C_CYN=$'\033[36m'; C_YLW=$'\033[33m'; C_BLD=$'\033[1m'
else
  C_RST=""; C_DIM=""; C_GRN=""; C_RED=""; C_CYN=""; C_YLW=""; C_BLD=""
fi
say()  { printf "%s\n" "$*"; }
ok()   { printf "${C_GRN}✓${C_RST} %s\n" "$*"; }
warn() { printf "${C_YLW}!${C_RST} %s\n" "$*"; }
die()  { printf "${C_RED}✗ %s${C_RST}\n" "$*" >&2; exit 1; }

BACKEND_PID=""; FRONTEND_PID=""
cleanup() {
  printf "\n${C_DIM}shutting down…${C_RST}\n"
  [[ -n "$BACKEND_PID" ]]  && kill "$BACKEND_PID"  2>/dev/null
  [[ -n "$FRONTEND_PID" ]] && kill "$FRONTEND_PID" 2>/dev/null
  # free the ports in case children outlived their parent (npm -> vite)
  lsof -ti "tcp:$BACKEND_PORT"  2>/dev/null | xargs kill 2>/dev/null
  lsof -ti "tcp:$FRONTEND_PORT" 2>/dev/null | xargs kill 2>/dev/null
}
trap cleanup EXIT INT TERM

free_port() { lsof -ti "tcp:$1" 2>/dev/null | xargs kill 2>/dev/null && warn "freed port $1 (was in use)"; }

# wait_http <url> <tries> : poll until it answers, return 0/1
wait_http() {
  local url="$1" tries="${2:-60}" i
  for ((i = 1; i <= tries; i++)); do
    curl -fsS -o /dev/null "$url" 2>/dev/null && return 0
    sleep 0.5
  done
  return 1
}

mkdir -p "$LOG_DIR"
: > "$BACKEND_LOG"; : > "$FRONTEND_LOG"

say "${C_BLD}VLM_Basketball dev launcher${C_RST}"
say "${C_DIM}root: $ROOT${C_RST}"

# --- preflight ---
command -v ffmpeg >/dev/null 2>&1 || warn "ffmpeg not found — clip slicing will fail (brew install ffmpeg)"

if [[ ! -x "$VENV_PY" ]]; then
  warn "no venv at .venv — creating with uv"
  command -v uv >/dev/null 2>&1 || die "uv not installed and no .venv present"
  uv venv "$ROOT/.venv" || die "uv venv failed"
fi
if ! "$VENV_PY" -c 'import fastapi, uvicorn, google.genai, boto3, httpx' 2>/dev/null; then
  warn "installing backend deps into .venv"
  uv pip install --python "$VENV_PY" -r "$ROOT/backend/requirements.txt" \
    || "$VENV_PY" -m pip install -r "$ROOT/backend/requirements.txt" \
    || die "backend dependency install failed"
fi
if [[ ! -f "$ROOT/backend/.env" ]]; then
  warn "backend/.env missing — copy backend/.env.example and fill in keys (Supabase reads / S3 clips will fail without it)"
fi
if [[ ! -d "$ROOT/frontend/node_modules" ]]; then
  warn "installing frontend deps (npm install)…"
  npm --prefix "$ROOT/frontend" install || die "npm install failed"
fi

# --- start backend ---
free_port "$BACKEND_PORT"
say "${C_DIM}starting backend on :$BACKEND_PORT …${C_RST}"
( cd "$ROOT/backend" && exec "$VENV_PY" -m uvicorn app.server:app \
    --host 127.0.0.1 --port "$BACKEND_PORT" --log-level info ) >"$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!

# --- start frontend ---
free_port "$FRONTEND_PORT"
say "${C_DIM}starting frontend on :$FRONTEND_PORT …${C_RST}"
( exec npm --prefix "$ROOT/frontend" run dev -- \
    --port "$FRONTEND_PORT" --strictPort ) >"$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!

# --- health checks ---
BACKEND_URL="http://127.0.0.1:$BACKEND_PORT"
FRONTEND_URL="http://localhost:$FRONTEND_PORT"

if wait_http "$BACKEND_URL/api/health" 60; then
  ok "backend healthy  ($BACKEND_URL/api/health)"
else
  printf "${C_RED}✗ backend failed health check — last 40 log lines:${C_RST}\n"
  tail -n 40 "$BACKEND_LOG"
  die "backend did not become healthy"
fi

if wait_http "$FRONTEND_URL" 60; then
  ok "frontend healthy ($FRONTEND_URL)"
else
  printf "${C_RED}✗ frontend failed health check — last 40 log lines:${C_RST}\n"
  tail -n 40 "$FRONTEND_LOG"
  die "frontend did not come up"
fi

# --- summary ---
HEALTH_JSON="$(curl -fsS "$BACKEND_URL/api/health" 2>/dev/null)"
SUPA="$(printf '%s' "$HEALTH_JSON" | grep -o '"supabase_configured":[^,}]*' | cut -d: -f2)"
printf '\n%s\n' "${C_GRN}${C_BLD}── ready ──${C_RST}"
printf '  %sOpen:%s     %s%s%s\n' "$C_BLD" "$C_RST" "$C_CYN" "$FRONTEND_URL" "$C_RST"
printf '  %sBackend:%s  %s/api/health  %ssupabase_configured=%s%s\n' \
  "$C_BLD" "$C_RST" "$BACKEND_URL" "$C_DIM" "${SUPA:-?}" "$C_RST"
printf '  %slogs:%s     backend=%s  frontend=%s\n' \
  "$C_DIM" "$C_RST" "$BACKEND_LOG" "$FRONTEND_LOG"
printf '%s\n\n' "${C_DIM}streaming backend logs — press Ctrl+C to stop both servers${C_RST}"

# --- stream backend logs in the foreground (Ctrl+C triggers cleanup) ---
tail -n +1 -f "$BACKEND_LOG"
