#!/bin/bash
# Construit le site si nécessaire, puis sert dist/ via Bun.
set -euo pipefail
cd "$(dirname "$0")"

LOG_DIR="./logs"
PORT="${LOFI_PORT:-4707}"
mkdir -p "$LOG_DIR"
> "$LOG_DIR/web.log"

if [ ! -d node_modules ]; then
  echo "[START] Installation des dépendances..."
  bun install >> "$LOG_DIR/web.log" 2>&1
fi

if [ ! -f dist/index.html ]; then
  echo "[START] Construction du site (Vite)..."
  bun run build >> "$LOG_DIR/web.log" 2>&1
fi

LOFI_PORT="$PORT" bun run server.ts >> "$LOG_DIR/web.log" 2>&1 &
echo $! > "$LOG_DIR/web.pid"
echo "[START] LoFi Engine démarré (PID: $(cat $LOG_DIR/web.pid)) — http://localhost:$PORT"
