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

# Sur un clone frais il n'y a pas de .env : on le crée depuis le modèle plutôt que
# de laisser l'utilisateur découvrir le manque par un message d'erreur.
if [ ! -f .env ] && [ -f .env.example ]; then
  cp .env.example .env
  echo "[START] .env créé depuis .env.example — clés de diffusion à renseigner"
  echo "        dans le centre de contrôle."
fi

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

# L'image du diffuseur embarque les scripts de diffusion : si elle existe déjà, la
# remettre à jour ici évite de diffuser avec une version périmée. Les scripts sont la
# dernière couche du Dockerfile — quand rien n'a changé, Docker ne fait que relire le cache.
if $DOCKER image inspect lofi-navigateur:local >/dev/null 2>&1; then
  echo "[START] Mise à jour de l'image de diffusion..."
  $COMPOSE --profile direct build direct >>"$LOG" 2>&1 \
    || echoerr "Mise à jour de l'image de diffusion échouée — voir $LOG"
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
    # Encoder en logiciel coûte un cœur entier en 1080p : le dire ici évite de
    # chercher longtemps pourquoi la machine sature une fois la diffusion lancée.
    case "$(bash stream/materiel.sh 2>/dev/null | sed -n 's/^MATERIEL=//p')" in
      nvidia) echo "        encodage : carte NVIDIA (NVENC) — le processeur n'encodera pas" ;;
      dri)    echo "        encodage : puce vidéo intégrée (VAAPI) — le processeur n'encodera pas" ;;
      *)      echo "        encodage : logiciel (aucune puce vidéo accessible) — compter"
              echo "                   environ un cœur en 1080p ; 1280x720 divise cette charge" ;;
    esac

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
