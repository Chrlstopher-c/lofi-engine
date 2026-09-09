#!/bin/bash
# Arrête et retire le conteneur. L'image et le cache de build sont conservés,
# le prochain démarrage est donc quasi immédiat.
set -uo pipefail
cd "$(dirname "$0")"

if ! command -v docker >/dev/null 2>&1; then
  echo "[STOP] Docker est introuvable — rien à arrêter." >&2
  exit 0
fi

if ! docker info >/dev/null 2>&1; then
  echo "[STOP] Le démon Docker ne répond pas — rien à arrêter." >&2
  exit 0
fi

COMPOSE="docker compose"
$COMPOSE version >/dev/null 2>&1 || COMPOSE="docker-compose"

if [ -z "$($COMPOSE ps -q 2>/dev/null)" ]; then
  echo "[STOP] Aucun conteneur en marche — rien à arrêter."
  exit 0
fi

if $COMPOSE down 2>&1 | tee -a ./logs/web.log; then
  echo "[STOP] LoFi Engine arrêté."
else
  echo "[STOP] L'arrêt a échoué — voir logs/web.log" >&2
  exit 1
fi
