#!/bin/bash
cd "$(dirname "$0")"
echo "[RESTART] Redémarrage..."
bash ./stop.sh
sleep 1
bash ./start.sh
