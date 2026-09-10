#!/bin/bash
# Diffuse le corpus enregistré en boucle, avec une image fixe, vers Twitch et/ou YouTube.
# Mode « increvable » : aucun navigateur, un seul ffmpeg qui lit des fichiers.
set -uo pipefail

ETIQUETTE="diffusion"
# shellcheck source=/dev/null
. /usr/local/lib/lofi/commun.sh

PERMUTATIONS=20
RELANCE_DELAI=10
LISTE="/tmp/playlist.txt"

lancer_ffmpeg() {
  local liste="$1" gop=$((STREAM_FPS * 2))
  ffmpeg -hide_banner -loglevel warning -nostdin \
    -re -loop 1 -framerate "$STREAM_FPS" -i "$STREAM_IMAGE" \
    -re -f concat -safe 0 -stream_loop -1 -i "$liste" \
    -map 0:v -map 1:a \
    -c:v libx264 -preset veryfast -tune stillimage -pix_fmt yuv420p \
    -vf "scale=${STREAM_RESOLUTION%x*}:${STREAM_RESOLUTION#*x},setsar=1" -r "$STREAM_FPS" \
    -b:v "$STREAM_VIDEO_BITRATE" -maxrate "$STREAM_VIDEO_BITRATE" \
    -bufsize "$STREAM_VIDEO_BITRATE" \
    -g "$gop" -keyint_min "$gop" -sc_threshold 0 \
    -c:a aac -b:a "$STREAM_AUDIO_BITRATE" -ar 44100 -ac 2 \
    "${FORMAT_SORTIE[@]}"
}

valider_plateformes
verifier_image_fixe
n=$(compter_corpus)
[ "$n" -gt 0 ] || echec "corpus vide dans $CORPUS_DIR — lancer d'abord le générateur (profil 'generateur')."
journal "configuration validée — $n fichier(s) dans le corpus"
construire_sortie
annoncer_destinations

trap 'journal "arrêt demandé"; exit 0' TERM INT

# Un flux 24/7 doit survivre à une coupure réseau : on relance, avec un ordre neuf.
while true; do
  journal "liste de lecture : $(construire_playlist "$LISTE" "$PERMUTATIONS") entrées"
  journal "démarrage de la diffusion"
  lancer_ffmpeg "$LISTE"
  journal "ffmpeg s'est arrêté (code $?) — nouvelle tentative dans ${RELANCE_DELAI}s"
  sleep "$RELANCE_DELAI"
done
