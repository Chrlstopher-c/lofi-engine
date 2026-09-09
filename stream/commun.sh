# Logique partagée entre le diffuseur (corpus en boucle) et le direct (génération continue).
# Sourcé, jamais exécuté.

STREAM_TWITCH="${STREAM_TWITCH:-false}"
STREAM_YOUTUBE="${STREAM_YOUTUBE:-false}"
TWITCH_INGEST="${TWITCH_INGEST:-rtmp://live.twitch.tv/app}"
YOUTUBE_INGEST="${YOUTUBE_INGEST:-rtmp://a.rtmp.youtube.com/live2}"
TWITCH_STREAM_KEY="${TWITCH_STREAM_KEY:-}"
YOUTUBE_STREAM_KEY="${YOUTUBE_STREAM_KEY:-}"
STREAM_IMAGE="${STREAM_IMAGE:-/corpus/fond.png}"
STREAM_RESOLUTION="${STREAM_RESOLUTION:-1920x1080}"
STREAM_FPS="${STREAM_FPS:-30}"
STREAM_VIDEO_BITRATE="${STREAM_VIDEO_BITRATE:-1500k}"
STREAM_AUDIO_BITRATE="${STREAM_AUDIO_BITRATE:-160k}"
CORPUS_DIR="${CORPUS_DIR:-/corpus}"

ETIQUETTE="${ETIQUETTE:-diffusion}"
FORMAT_SORTIE=()   # rempli par construire_sortie, consommé par les lanceurs ffmpeg

# shellcheck source=/dev/null
. /usr/local/lib/lofi/base.sh

# Refuse avant toute connexion, en nommant précisément ce qui manque.
valider_plateformes() {
  local manques=()
  vrai "$STREAM_TWITCH"  && [ -z "$TWITCH_STREAM_KEY" ]  && manques+=("TWITCH_STREAM_KEY (STREAM_TWITCH=true)")
  vrai "$STREAM_YOUTUBE" && [ -z "$YOUTUBE_STREAM_KEY" ] && manques+=("YOUTUBE_STREAM_KEY (STREAM_YOUTUBE=true)")

  if ! vrai "$STREAM_TWITCH" && ! vrai "$STREAM_YOUTUBE"; then
    echec "aucune plateforme activée. Mettre STREAM_TWITCH=true et/ou STREAM_YOUTUBE=true dans le .env."
  fi
  if [ ${#manques[@]} -gt 0 ]; then
    printf '[%s] ÉCHEC — clé absente :\n' "$ETIQUETTE" >&2
    printf '   - %s\n' "${manques[@]}" >&2
    printf '   Les clés se récupèrent dans le tableau de bord de chaque plateforme,\n' >&2
    printf '   et se renseignent dans le .env (jamais versionné).\n' >&2
    exit 1
  fi
}

# Une sortie simple, ou le muxer tee vers deux destinations en une seule passe d'encodage.
construire_sortie() {
  local cibles=()
  vrai "$STREAM_TWITCH"  && cibles+=("${TWITCH_INGEST%/}/${TWITCH_STREAM_KEY}")
  vrai "$STREAM_YOUTUBE" && cibles+=("${YOUTUBE_INGEST%/}/${YOUTUBE_STREAM_KEY}")

  if [ ${#cibles[@]} -eq 1 ]; then
    FORMAT_SORTIE=(-f flv "${cibles[0]}")
    return 0
  fi
  local tee="" c
  for c in "${cibles[@]}"; do
    [ -n "$tee" ] && tee+="|"
    tee+="[f=flv:onfail=ignore]${c}"
  done
  FORMAT_SORTIE=(-f tee "$tee")
}

annoncer_destinations() {
  vrai "$STREAM_TWITCH"  && journal "destination : Twitch (${TWITCH_INGEST})"
  vrai "$STREAM_YOUTUBE" && journal "destination : YouTube (${YOUTUBE_INGEST})"
  journal "rendu : $STREAM_RESOLUTION @ ${STREAM_FPS} i/s · vidéo $STREAM_VIDEO_BITRATE · audio $STREAM_AUDIO_BITRATE"
  vrai "${STREAM_SCENE:-false}" || journal "image de fond : $STREAM_IMAGE"
}

# Liste de lecture du corpus, mélangée <n> fois pour retarder la répétition.
construire_playlist() {
  local liste="$1" passes="${2:-20}" i
  : > "$liste"
  for ((i = 0; i < passes; i++)); do
    find "$CORPUS_DIR" -type f \( -name '*.flac' -o -name '*.wav' -o -name '*.ogg' \) \
      | shuf | sed "s/'/'\\\\''/g; s|^|file '|; s|$|'|" >> "$liste"
  done
  wc -l < "$liste"
}

compter_corpus() {
  find "$CORPUS_DIR" -type f \( -name '*.flac' -o -name '*.wav' -o -name '*.ogg' \) | wc -l
}

verifier_image_fixe() {
  [ -f "$STREAM_IMAGE" ] || echec "image de fond introuvable : $STREAM_IMAGE (variable STREAM_IMAGE)"
}
