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
ECRAN=""                 # écran capturé, calé sur la résolution une fois celle-ci arrêtée
LOFI_BASE="${LOFI_BASE:-http://lofi-engine:4707}"
LOFI_URL="${LOFI_URL:-}"
PULSATION=2              # secondes entre deux vérifications que le navigateur est vivant
PULSATIONS_PAR_CONTROLE=10   # une mesure de niveau toutes les 10 pulsations (20 s)
MESURE=4                 # durée d'une mesure de niveau
SILENCES_TOLERES=2       # contrôles muets consécutifs avant de basculer sur le repli
CYCLES_AVANT_RETEST=15   # contrôles sous repli avant de retenter le navigateur (~5 min)
STREAM_ENCODEUR="${STREAM_ENCODEUR:-auto}"   # auto | nvenc | vaapi | x264
NOEUD_RENDU="${NOEUD_RENDU:-/dev/dri/renderD128}"
STREAM_ADAPTER="${STREAM_ADAPTER:-true}"     # abaisser la définition si la machine ne suit pas
COEURS_POUR_1080P_LOGICIEL=6                 # mesuré : 1080p sans puce vidéo coûte ~3 cœurs pleins
ENCODEUR_RETENU=""
REPLI_PID=""
DIFFUSION_PID=""
ENTREE_VIDEO=()
PREFIXE_ENCODEUR=()   # options globales, avant les entrées
ENCODEUR_VIDEO=()     # codec et mise à l'échelle, remplis par choisir_encodeur

# Encoder en logiciel coûte un cœur entier en 1080p ; la puce vidéo d'un GPU le fait pour rien.
# Chaque profil est essayé pour de vrai avant d'être retenu : une carte visible ne garantit pas
# que la bibliothèque d'encodage soit là, et découvrir l'échec en direct coûterait le flux.
profil_encodeur() {
  local largeur="${STREAM_RESOLUTION%x*}" hauteur="${STREAM_RESOLUTION#*x}"
  PREFIXE_ENCODEUR=()
  case "$1" in
    nvenc)
      ENCODEUR_VIDEO=(-c:v h264_nvenc -preset p4 -tune ll -rc cbr -pix_fmt yuv420p
                      -s "$STREAM_RESOLUTION" -r "$STREAM_FPS") ;;
    vaapi)
      PREFIXE_ENCODEUR=(-vaapi_device "$NOEUD_RENDU")
      # La mise à l'échelle se fait avant le transfert vers la carte : une seule copie.
      ENCODEUR_VIDEO=(-vf "scale=${largeur}:${hauteur},format=nv12,hwupload"
                      -c:v h264_vaapi -rc_mode CBR -r "$STREAM_FPS") ;;
    x264)
      ENCODEUR_VIDEO=(-c:v libx264 -preset veryfast -tune stillimage -pix_fmt yuv420p
                      -s "$STREAM_RESOLUTION" -r "$STREAM_FPS" -sc_threshold 0) ;;
    *) return 1 ;;
  esac
  return 0
}

# Encode une image noire avec le profil demandé. Silencieux : seul le code de sortie compte.
essayer_encodeur() {
  profil_encodeur "$1" || return 1
  ffmpeg -hide_banner -loglevel error -nostdin "${PREFIXE_ENCODEUR[@]}" \
    -f lavfi -i "color=c=black:s=${STREAM_RESOLUTION}:r=${STREAM_FPS}" -frames:v 1 \
    "${ENCODEUR_VIDEO[@]}" -b:v "$STREAM_VIDEO_BITRATE" -f null - >/dev/null 2>&1
}

choisir_encodeur() {
  local candidats=(nvenc vaapi x264) choix
  if [ "$STREAM_ENCODEUR" != "auto" ]; then
    if essayer_encodeur "$STREAM_ENCODEUR"; then
      ENCODEUR_RETENU="$STREAM_ENCODEUR"
      journal "encodeur : $STREAM_ENCODEUR (imposé par STREAM_ENCODEUR)"
      return 0
    fi
    journal "ATTENTION : encodeur $STREAM_ENCODEUR demandé mais inutilisable ici — retour au choix automatique"
  fi
  for choix in "${candidats[@]}"; do
    if essayer_encodeur "$choix"; then
      ENCODEUR_RETENU="$choix"
      case "$choix" in
        nvenc) journal "encodeur : NVENC (puce vidéo NVIDIA) — le processeur n'encode plus" ;;
        vaapi) journal "encodeur : VAAPI via $NOEUD_RENDU — le processeur n'encode plus" ;;
        x264)  journal "encodeur : libx264 (logiciel). Aucune puce vidéo accessible : compter
       environ un cœur en 1080p. Donner /dev/dri ou un GPU au conteneur divise cette charge." ;;
      esac
      return 0
    fi
    journal "encodeur $choix indisponible, essai suivant"
  done
  echec "aucun encodeur vidéo utilisable, pas même libx264"
}

# Sans puce vidéo, le 1080p demande environ trois cœurs pour l'encodage, plus autant pour le
# navigateur qui décode le fond : sur une petite machine le flux ne décroche pas franchement,
# il s'étrangle — les tampons gonflent jusqu'à ce que quelque chose meure. Mieux vaut diffuser
# en 1280x720 que crasher au bout d'une minute. Se désactive avec STREAM_ADAPTER=false.
adapter_charge() {
  ECRAN="${ECRAN_DIRECT:-${STREAM_RESOLUTION}x24}"
  vrai "$STREAM_ADAPTER" || return 0
  [ "$ENCODEUR_RETENU" = "x264" ] || return 0
  [ "${STREAM_RESOLUTION%x*}" -gt 1280 ] || return 0

  local coeurs
  coeurs=$(nproc 2>/dev/null || echo 0)
  [ "$coeurs" -lt "$COEURS_POUR_1080P_LOGICIEL" ] || return 0

  journal "définition abaissée à 1280x720 : ${coeurs} cœur(s) et aucune puce vidéo accessible,
       ${STREAM_RESOLUTION} en logiciel en demande environ ${COEURS_POUR_1080P_LOGICIEL}.
       Pour diffuser malgré tout en ${STREAM_RESOLUTION}, mettre STREAM_ADAPTER=false dans le .env.
       Pour retrouver la pleine définition, donner une puce vidéo au conteneur : sur Proxmox, un
       conteneur LXC voit /dev/dri de l'hôte, une machine virtuelle non."
  STREAM_RESOLUTION="1280x720"
  ECRAN="${ECRAN_DIRECT:-1280x720x24}"
  profil_encodeur "$ENCODEUR_RETENU"
}

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
        "${PREFIXE_ENCODEUR[@]}" \
        "${ENTREE_VIDEO[@]}" \
        -thread_queue_size 1024 -f pulse -i "${SINK}.monitor" \
        -map 0:v -map 1:a \
        "${ENCODEUR_VIDEO[@]}" \
        -b:v "$STREAM_VIDEO_BITRATE" -maxrate "$STREAM_VIDEO_BITRATE" \
        -bufsize "$STREAM_VIDEO_BITRATE" \
        -g "$gop" -keyint_min "$gop" \
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
  # Aucun paramètre : la scène se définit dans scene.json, écrit par le centre de contrôle.
  # Passer des valeurs ici recréerait une seconde source de vérité qui l'écraserait.
  echo "${LOFI_BASE}/scene/scene.html"
}

valider_plateformes
vrai "$STREAM_SCENE" || verifier_image_fixe
construire_sortie
# L'encodeur et la définition se décident avant tout le reste : l'écran virtuel, le navigateur
# et l'annonce des destinations en dépendent tous les trois.
choisir_encodeur
adapter_charge
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
