#!/usr/bin/env bash
set -euo pipefail

echo "[DEV] Meeting Bot starting..."

# ---------------------------
# Environment
# ---------------------------
export DISPLAY=:99
export XDG_RUNTIME_DIR=/tmp
export PULSE_SERVER=${PULSE_SERVER:-unix:/run/pulse/native}
export NODE_ENV=${NODE_ENV:-development}

# ---------------------------
# Verify PulseAudio socket
# ---------------------------
if [[ ! -S /run/pulse/native ]]; then
  echo "[FATAL] PulseAudio socket not found at /run/pulse/native"
  echo "Dev hint:"
  echo "  Debian desktop → user-mode PulseAudio"
  echo "  Mount: /run/user/$(id -u)/pulse → /run/pulse"
  exit 1
fi

echo "[✓] PulseAudio socket detected"

# ---------------------------
# Verify virtual sink exists
# ---------------------------
if ! pactl list short sinks | grep -q "virtual_output"; then
  echo "[FATAL] virtual_output sink not found on host"
  echo "Create once on host:"
  echo "  pactl load-module module-null-sink sink_name=virtual_output"
  exit 1
fi

echo "[✓] virtual_output sink present"

# ---------------------------
# Start Xvfb (headless display)
# ---------------------------
echo "[DEV] Starting Xvfb..."
Xvfb :99 -screen 0 1440x900x24 &
XVFB_PID=$!

sleep 2

# ---------------------------
# Graceful shutdown
# ---------------------------
cleanup() {
  echo "[DEV] Shutting down..."
  if ps -p $XVFB_PID > /dev/null 2>&1; then
    kill $XVFB_PID
  fi
}
trap cleanup EXIT INT TERM

# ---------------------------
# Start Node app (DEV)
# ---------------------------
if command -v nodemon >/dev/null 2>&1; then
  echo "[DEV] Using nodemon for hot reload"
  exec nodemon --watch dist --signal SIGTERM dist/index.js
else
  echo "[DEV] nodemon not found, falling back to node"
  exec node dist/index.js
fi
