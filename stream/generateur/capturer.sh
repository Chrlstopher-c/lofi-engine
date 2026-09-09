#!/bin/bash
# Enregistre la sortie audio du moteur lofi dans des segments FLAC, sur le volume du corpus.
# Sans perte volontairement : le corpus n'est encodé qu'une fois, à la diffusion.
set -uo pipefail

ETIQUETTE="capture"
# shellcheck source=/dev/null
. /usr/local/lib/lofi/base.sh
# shellcheck source=/dev/null
. /usr/local/lib/lofi/navigateur.sh

CORPUS_DIR="${CORPUS_DIR:-/corpus}"
LOFI_URL="${LOFI_URL:-http://lofi-engine:4707/?autoplay=1}"
CAPTURE_DUREE="${CAPTURE_DUREE:-600}"
SEGMENT_DUREE="${SEGMENT_DUREE:-600}"
ESSAI_DUREE=15          # essai avant la vraie capture, pour ne pas enregistrer 6 h de silence
TAILLE_PLANCHER=102400  # octets : en dessous, le segment est un résidu tronqué

verifier_presence_son() {
  journal "essai de ${ESSAI_DUREE}s pour vérifier qu'il y a bien du son…"
  local niveau
  niveau=$(mesurer_niveau "$ESSAI_DUREE")
  [ -n "$niveau" ] || echec "ffmpeg n'a pas pu lire ${SINK}.monitor"
  journal "niveau moyen mesuré : ${niveau} dBFS"
  if awk -v n="$niveau" -v s="$SILENCE_SEUIL" 'BEGIN{exit !(n < s)}'; then
    echec "silence (${niveau} dBFS). Le moteur ne joue pas : vérifier que l'URL contient
       ?autoplay=1, que le site répond, et /tmp/chromium.log pour une erreur de chargement."
  fi
  journal "son confirmé — lancement de la capture"
}

# Le muxer segment ouvre un dernier fichier juste avant de s'arrêter : il reste un résidu.
# Il n'écrit pas la durée dans l'en-tête FLAC (ffprobe rend « N/A ») : on juge sur le niveau
# sonore, et sur la taille pour attraper les fichiers tronqués.
elaguer_segments() {
  local horodatage="$1" f octets niveau ecartes=0
  for f in "$CORPUS_DIR"/lofi-"$horodatage"-*.flac; do
    [ -f "$f" ] || continue
    octets=$(stat -c%s "$f" 2>/dev/null || echo 0)
    niveau=$(ffmpeg -hide_banner -nostats -i "$f" -af volumedetect -f null - 2>&1 \
             | grep -oP 'mean_volume:\s*\K-?[0-9.]+' | tail -1)
    if [ "$octets" -lt "$TAILLE_PLANCHER" ] || [ -z "$niveau" ] \
       || awk -v n="$niveau" -v s="$SILENCE_SEUIL" 'BEGIN{exit !(n < s)}'; then
      rm -f "$f"
      journal "écarté : $(basename "$f") ($((octets / 1024)) Ko, ${niveau:-illisible} dBFS)"
      ecartes=$((ecartes + 1))
    fi
  done
  [ "$ecartes" -gt 0 ] && journal "$ecartes segment(s) inexploitable(s) écarté(s)"
  return 0
}

capturer() {
  local horodatage motif
  horodatage=$(date +%Y%m%d-%H%M%S)
  motif="${CORPUS_DIR}/lofi-${horodatage}-%03d.flac"
  journal "capture de ${CAPTURE_DUREE}s en segments de ${SEGMENT_DUREE}s vers $CORPUS_DIR"

  ffmpeg -hide_banner -nostats -loglevel warning \
    -thread_queue_size 1024 -f pulse -i "${SINK}.monitor" \
    -t "$CAPTURE_DUREE" \
    -ac 2 -ar 48000 -c:a flac -compression_level 5 \
    -f segment -segment_time "$SEGMENT_DUREE" -reset_timestamps 1 \
    "$motif"
  local code=$?
  [ "$code" -eq 0 ] || echec "ffmpeg a rendu le code $code pendant la capture"

  elaguer_segments "$horodatage"

  local n poids
  n=$(find "$CORPUS_DIR" -name "lofi-${horodatage}-*.flac" | wc -l)
  poids=$(du -sh "$CORPUS_DIR" 2>/dev/null | cut -f1)
  [ "$n" -gt 0 ] || echec "aucun segment écrit dans $CORPUS_DIR"
  journal "terminé — $n segment(s) écrit(s), corpus total : $poids"
}

nettoyer() {
  arreter_navigateur
  pulseaudio --kill 2>/dev/null
  return 0
}
trap nettoyer EXIT

mkdir -p "$CORPUS_DIR" || echec "corpus non inscriptible : $CORPUS_DIR"
demarrer_environnement
demarrer_navigateur "$LOFI_URL"
attendre "chargement des échantillons" 90 'pactl list sink-inputs 2>/dev/null | grep -q .' \
  || echec "le navigateur n'a jamais produit de flux audio (voir /tmp/chromium.log)"
verifier_presence_son
capturer
