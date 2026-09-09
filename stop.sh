#!/bin/bash
# Arrête le serveur par son PID, jamais par motif de nom.
cd "$(dirname "$0")"

PID_FILE="./logs/web.pid"
if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID" && echo "[STOP] LoFi Engine stoppé (PID: $PID)"
  else
    echo "[STOP] Aucun processus vivant pour le PID $PID"
  fi
  rm -f "$PID_FILE"
else
  echo "[STOP] Aucun PID enregistré — rien à arrêter"
fi
