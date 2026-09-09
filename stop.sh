#!/bin/bash
# Arrête et retire le conteneur. L'image et le cache de build sont conservés,
# le prochain démarrage est donc quasi immédiat.
set -uo pipefail
cd "$(dirname "$0")"

# shellcheck source=docker-cli.sh
source ./docker-cli.sh

if ! detecter_docker; then
  echo "[STOP] Aucun client Docker utilisable — rien à arrêter." >&2
  exit 0
fi

if [ -z "$($COMPOSE ps -q 2>/dev/null)" ]; then
  echo "[STOP] Aucun conteneur en marche — rien à arrêter."
  exit 0
fi

mkdir -p ./logs
if $COMPOSE down 2>&1 | tee -a ./logs/web.log; then
  echo "[STOP] LoFi Engine arrêté."
else
  echo "[STOP] L'arrêt a échoué — voir logs/web.log" >&2
  exit 1
fi
