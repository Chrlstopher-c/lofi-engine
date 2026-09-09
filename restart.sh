#!/bin/bash
# Arrêt puis relance. Le journal est remis à zéro par start.sh.
set -uo pipefail
cd "$(dirname "$0")"

echo "[RESTART] Arrêt..."
bash ./stop.sh || { echo "[RESTART] Arrêt en échec, on ne relance pas." >&2; exit 1; }
echo "[RESTART] Relance..."
exec bash ./start.sh
