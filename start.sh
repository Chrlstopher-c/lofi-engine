#!/bin/bash
# Lance LoFi Engine en conteneur. Fonctionne sur un clone frais : rien n'est
# requis en local hors d'un client Docker — l'installation et le build ont
set -uo pipefail
cd "$(dirname "$0")"

# shellcheck source=docker-cli.sh
source ./docker-cli.sh
# shellcheck source=controle.sh
source ./controle.sh

LOG_DIR="./logs"
LOG="$LOG_DIR/web.log"
PORT="${LOFI_PORT:-4707}"
mkdir -p "$LOG_DIR"
: > "$LOG"

echoerr() { printf '[START] %s\n' "$*" >&2; }

if ! detecter_docker; then
  echoerr "Impossible de démarrer."
  expliquer_absence_docker
  exit 1
fi
echo "[START] Client détecté : $DOCKER (compose : $COMPOSE)"

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

echo "[START] Attente de la réponse du serveur..."
DELAI=60
for ((i = 1; i <= DELAI; i++)); do
  if curl -sf -o /dev/null -m 3 "http://127.0.0.1:$PORT/" 2>/dev/null; then
    IP=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(j=1;j<=NF;j++) if($j=="src") print $(j+1)}' | head -1)
    echo "[START] LoFi Engine est en marche."
    echo "        local  : http://localhost:$PORT"
    [ -n "${IP:-}" ] && echo "        réseau : http://$IP:$PORT"
    echo "        scène  : http://localhost:$PORT/scene/scene.html"
    if demarrer_controle; then
      echo ""
      echo "[START] Centre de contrôle — scène, calques, clés, diffusion"
      echo "        local  : http://localhost:$CONTROLE_PORT"
      [ -n "${IP:-}" ] && echo "        réseau : http://$IP:$CONTROLE_PORT"
    else
      echoerr "Le site tourne, mais le centre de contrôle n'a pas démarré."
    fi
    echo ""
    echo "        arrêt  : ./stop.sh"
    exit 0
  fi
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
