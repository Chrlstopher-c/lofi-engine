#!/bin/bash
# Diffusion en direct : le moteur génère la musique en continu dans un navigateur,
# ffmpeg pousse cette sortie vers Twitch et/ou YouTube sans jamais s'interrompre.
#
# Le repli joue le corpus enregistré DANS le même puits audio : si le navigateur meurt,
# ffmpeg continue de lire le puits et le flux ne se coupe pas. C'est tout l'intérêt.
set -uo pipefail

ETIQUETTE="direct"
# shellcheck source=/dev/null
. /usr/local/lib/lofi/commun.sh
# shellcheck source=/dev/null
. /usr/local/lib/lofi/navigateur.sh

STREAM_SCENE="${STREAM_SCENE:-true}"   # false = image fixe au lieu de la scène animée
ECRAN="${ECRAN_DIRECT:-${STREAM_RESOLUTION}x24}"   # l'écran capturé suit la résolution du flux
LOFI_BASE="${LOFI_BASE:-http://lofi-engine:4707}"
LOFI_URL="${LOFI_URL:-}"
PULSATION=2              # secondes entre deux vérifications que le navigateur est vivant
PULSATIONS_PAR_CONTROLE=10   # une mesure de niveau toutes les 10 pulsations (20 s)
MESURE=4                 # durée d'une mesure de niveau
SILENCES_TOLERES=2       # contrôles muets consécutifs avant de basculer sur le repli
CYCLES_AVANT_RETEST=15   # contrôles sous repli avant de retenter le navigateur (~5 min)
REPLI_PID=""
DIFFUSION_PID=""
ENTREE_VIDEO=()

# Source vidéo : l'écran virtuel où le navigateur affiche la scène, ou une image fixe.
choisir_entree_video() {
  if vrai "$STREAM_SCENE"; then
    ENTREE_VIDEO=(-thread_queue_size 512 -f x11grab -draw_mouse 0 -framerate "$STREAM_FPS"
                  -video_size "${ECRAN%x*}" -i "$DISPLAY")
    journal "vidéo : capture de la scène (${ECRAN%x*})"
  else
    ENTREE_VIDEO=(-thread_queue_size 512 -re -loop 1 -framerate "$STREAM_FPS" -i "$STREAM_IMAGE")
    journal "vidéo : image fixe ($STREAM_IMAGE)"
  fi
}

lancer_diffusion() {
  local gop=$((STREAM_FPS * 2))
  ( while true; do
      ffmpeg -hide_banner -loglevel warning -nostdin \
        "${ENTREE_VIDEO[@]}" \
        -thread_queue_size 1024 -f pulse -i "${SINK}.monitor" \
        -map 0:v -map 1:a \
        -c:v libx264 -preset veryfast -tune stillimage -pix_fmt yuv420p \
        -s "$STREAM_RESOLUTION" -r "$STREAM_FPS" \
        -b:v "$STREAM_VIDEO_BITRATE" -maxrate "$STREAM_VIDEO_BITRATE" \
        -bufsize "$STREAM_VIDEO_BITRATE" \
        -g "$gop" -keyint_min "$gop" -sc_threshold 0 \
        -c:a aac -b:a "$STREAM_AUDIO_BITRATE" -ar 44100 -ac 2 \
        "${FORMAT_SORTIE[@]}"
      journal "le flux s'est interrompu — reconnexion dans 10 s"
      sleep 10
    done ) &
  DIFFUSION_PID=$!
  journal "diffusion lancée (PID $DIFFUSION_PID)"
}

demarrer_repli() {
  [ -z "$REPLI_PID" ] || return 0
  if [ "$(compter_corpus)" -eq 0 ]; then
    journal "ATTENTION : pas de corpus de secours, le flux restera muet jusqu'au retour du moteur"
    return 1
  fi
  construire_playlist /tmp/repli.txt 20 >/dev/null
  ffmpeg -hide_banner -loglevel error -nostdin \
    -re -f concat -safe 0 -stream_loop -1 -i /tmp/repli.txt \
    -f pulse -device "$SINK" "repli-lofi" >/tmp/repli.log 2>&1 &
  REPLI_PID=$!
  journal "repli activé — lecture du corpus enregistré"
}

arreter_repli() {
  [ -n "$REPLI_PID" ] || return 0
  kill "$REPLI_PID" 2>/dev/null
  wait "$REPLI_PID" 2>/dev/null
  REPLI_PID=""
  journal "repli arrêté"
}

relancer_navigateur() {
  journal "relance du navigateur"
  arreter_navigateur
  demarrer_navigateur "$(construire_url)" kiosque || return 1
  attendre "reprise du moteur" 90 'il_y_a_du_son 3'
}

nettoyer() {
  arreter_repli
  arreter_navigateur
  [ -n "$DIFFUSION_PID" ] && kill "$DIFFUSION_PID" 2>/dev/null
  pulseaudio --kill 2>/dev/null
  return 0
}
trap 'journal "arrêt demandé"; nettoyer; exit 0' TERM INT
trap nettoyer EXIT

# Bascule sur le corpus, tente de relever le navigateur, et coupe le repli s'il repart.
basculer_et_relever() {
  demarrer_repli
  if relancer_navigateur; then
    arreter_repli
    journal "moteur reparti — retour à la génération en direct"
    return 0
  fi
  journal "le moteur n'est pas reparti — le corpus prend le relais"
  return 1
}

# Le repli tourne : on le coupe brièvement pour voir si le moteur a repris de lui-même.
retester_moteur() {
  arreter_repli
  if il_y_a_du_son "$MESURE"; then
    journal "moteur revenu de lui-même — retour à la génération en direct"
    return 0
  fi
  basculer_et_relever
  return 1
}

# Boucle de supervision, à deux vitesses : la mort du navigateur est le cas le plus probable
# et doit être vue en quelques secondes, sinon le flux part en silence le temps qu'on s'en
# aperçoive. La mesure de niveau, elle, coûte plusieurs secondes d'écoute : elle est plus rare.
# C'est le processus principal du conteneur ; il ne se termine que sur signal (voir le trap).
surveiller() {
  local silences=0 cycles_repli=0 tic=0
  while true; do
    sleep "$PULSATION"

    if ! kill -0 "$NAVIGATEUR_PID" 2>/dev/null; then
      journal "le navigateur ne tourne plus"
      basculer_et_relever && silences=0
      cycles_repli=0; tic=0
      continue
    fi

    tic=$((tic + 1))
    [ "$tic" -ge "$PULSATIONS_PAR_CONTROLE" ] || continue
    tic=0

    if [ -n "$REPLI_PID" ]; then
      cycles_repli=$((cycles_repli + 1))
      if [ "$cycles_repli" -ge "$CYCLES_AVANT_RETEST" ]; then
        cycles_repli=0
        retester_moteur && silences=0
      fi
      continue
    fi

    if il_y_a_du_son "$MESURE"; then
      silences=0
    else
      silences=$((silences + 1))
      journal "silence détecté ($silences/$SILENCES_TOLERES)"
      if [ "$silences" -ge "$SILENCES_TOLERES" ]; then
        basculer_et_relever && silences=0
      fi
    fi
  done
}

# La scène est servie par le conteneur du site : même origine que le moteur, donc l'iframe
# qui produit le son n'est pas bridée par la politique inter-origines.
construire_url() {
  if [ -n "$LOFI_URL" ]; then echo "$LOFI_URL"; return 0; fi
  if ! vrai "$STREAM_SCENE"; then echo "${LOFI_BASE}/?autoplay=1"; return 0; fi
  local q="titre=$(encoder_url "${STREAM_TITRE:-}")"
  q+="&sousTitre=$(encoder_url "${STREAM_SOUS_TITRE:-}")"
  q+="&credits=$(encoder_url "${STREAM_CREDITS:-}")"
  q+="&fond=$(encoder_url "/fonds/${STREAM_FOND:-}")"
  q+="&horloge=${STREAM_HORLOGE:-true}&accords=${STREAM_ACCORDS:-true}"
  q+="&theme=${STREAM_THEME:-nuit}"
  echo "${LOFI_BASE}/scene/scene.html?${q}"
}

valider_plateformes
vrai "$STREAM_SCENE" || verifier_image_fixe
construire_sortie
annoncer_destinations
journal "corpus de secours : $(compter_corpus) fichier(s)"

demarrer_environnement
demarrer_navigateur "$(construire_url)" kiosque
attendre "chargement des échantillons" 90 'pactl list sink-inputs 2>/dev/null | grep -q .' \
  || echec "le navigateur n'a jamais produit de flux audio (voir /tmp/chromium.log)"
il_y_a_du_son 10 || echec "silence au démarrage — vérifier que l'URL contient ?autoplay=1"
journal "moteur en marche — début de la diffusion en direct"

choisir_entree_video
lancer_diffusion
surveiller
