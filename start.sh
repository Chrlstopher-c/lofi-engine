#!/bin/bash
# Lance LoFi Engine dans Docker. Fonctionne sur un clone frais : rien n'est
# requis en local hors Docker — l'installation et le build ont lieu dans l'image.
set -uo pipefail
cd "$(dirname "$0")"

LOG_DIR="./logs"
LOG="$LOG_DIR/web.log"
PORT="${LOFI_PORT:-4707}"
mkdir -p "$LOG_DIR"
: > "$LOG"

echoerr() { printf '[START] %s\n' "$*" >&2; }

# --- Vérifications préalables, avec un message actionnable pour chacune ---
if ! command -v docker >/dev/null 2>&1; then
  echoerr "Docker est introuvable. Installe-le, puis relance ce script."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echoerr "Le démon Docker ne répond pas."
  echoerr "  → démarre-le : sudo systemctl start docker"
  echoerr "  → ou ajoute-toi au groupe : sudo usermod -aG docker \$USER (puis reconnecte-toi)"
  exit 1
fi

COMPOSE="docker compose"
if ! $COMPOSE version >/dev/null 2>&1; then
  command -v docker-compose >/dev/null 2>&1 || {
    echoerr "Ni 'docker compose' ni 'docker-compose' ne sont disponibles."
    exit 1
  }
  COMPOSE="docker-compose"
fi

# --- Construction et lancement, sortie visible ET journalisée ---
echo "[START] Construction de l'image et démarrage (la première fois prend quelques minutes)..."
echo "[START] Journal complet : $LOG"
set -o pipefail
LOFI_PORT="$PORT" $COMPOSE up -d --build 2>&1 | tee -a "$LOG"
CODE=${PIPESTATUS[0]}
if [ "$CODE" -ne 0 ]; then
  echoerr "La construction ou le démarrage a échoué (code $CODE)."
  echoerr "Les 30 dernières lignes du journal :"
  tail -30 "$LOG" >&2
  exit "$CODE"
fi

# --- Attente active de la première réponse ---
echo "[START] Attente de la réponse du serveur..."
DELAI=60
for ((i = 1; i <= DELAI; i++)); do
  if curl -sf -o /dev/null -m 3 "http://127.0.0.1:$PORT/" 2>/dev/null; then
    IP=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(j=1;j<=NF;j++) if($j=="src") print $(j+1)}' | head -1)
    echo "[START] LoFi Engine est en marche."
    echo "        local  : http://localhost:$PORT"
    [ -n "${IP:-}" ] && echo "        réseau : http://$IP:$PORT"
    echo "        arrêt  : ./stop.sh"
    exit 0
  fi
  # Si le conteneur est mort entre-temps, inutile d'attendre la fin du délai
  if [ -z "$($COMPOSE ps -q 2>/dev/null)" ]; then
    echoerr "Le conteneur s'est arrêté pendant le démarrage."
    $COMPOSE logs --tail 30 2>&1 | tee -a "$LOG" >&2
    exit 1
  fi
  sleep 1
done

echoerr "Pas de réponse sur le port $PORT après $DELAI s."
echoerr "Journal du conteneur :"
$COMPOSE logs --tail 30 2>&1 | tee -a "$LOG" >&2
exit 1
