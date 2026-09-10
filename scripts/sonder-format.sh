#!/bin/sh
# Mesure ce que le conteneur de diffusion émet RÉELLEMENT : définition, rapport de pixel,
# rapport d'affichage, et bandes noires dans l'image.
#
# À lancer depuis la machine qui diffuse, sans rien reconstruire :
#   docker exec -i lofi-direct sh -s < scripts/sonder-format.sh
#
# Cette sonde existe parce que « le flux sort en 1920x1080 » est une croyance tant que
# personne n'a regardé le flux. Elle rejoue la composition telle qu'elle tourne, en encode
# deux secondes dans un fichier, et lit ce fichier.
set -u

CORPUS_DIR="${CORPUS_DIR:-/corpus}"
SCENE="${CORPUS_DIR}/scene.json"
ECHANTILLON=/tmp/lofi-echantillon.mp4

echo "--- ce que le conteneur croit devoir émettre ---"
echo "  STREAM_RESOLUTION = ${STREAM_RESOLUTION:-non défini}"
echo "  STREAM_FPS        = ${STREAM_FPS:-non défini}"
echo "  STREAM_SCENE      = ${STREAM_SCENE:-non défini}"

echo "--- le fond de la scène ---"
if [ -f "$SCENE" ]; then
  python3 - "$SCENE" <<'PY'
import json, sys, pathlib
try:
    fond = json.loads(pathlib.Path(sys.argv[1]).read_text()).get("fond", {})
except Exception as erreur:
    print(f"  scène illisible : {erreur}")
else:
    for cle in ("fichier", "mouvement", "ajustement"):
        print(f"  {cle:11}= {fond.get(cle)}")
PY
  fichier=$(python3 -c "import json,sys;print(json.load(open(sys.argv[1])).get('fond',{}).get('fichier',''))" "$SCENE")
  [ -n "$fichier" ] && ffprobe -v error -select_streams v:0 \
    -show_entries stream=width,height,sample_aspect_ratio,display_aspect_ratio \
    -of default=nw=1 "${CORPUS_DIR}/${fichier}" 2>&1 | sed 's/^/  source : /'
else
  echo "  $SCENE absent"
fi

echo "--- la composition, encodée pour de vrai (2 s) ---"
ARGS=$(CORPUS_DIR="$CORPUS_DIR" python3 /usr/local/bin/composer.py "$SCENE" 2>/dev/null | tr '\n' '\t')
if [ -z "$ARGS" ]; then
  echo "  composition impossible — le flux passe par le navigateur, pas par ffmpeg."
  exit 0
fi
OLD=$IFS; IFS='	'
# shellcheck disable=SC2086
ffmpeg -v error -y $ARGS -t 2 -c:v libx264 -preset ultrafast -pix_fmt yuv420p \
  -aspect "${STREAM_RESOLUTION%x*}:${STREAM_RESOLUTION#*x}" "$ECHANTILLON" 2>&1 | sed 's/^/  /'
IFS=$OLD
[ -f "$ECHANTILLON" ] || { echo "  échantillon non produit"; exit 1; }

echo "--- CE QUI PART VRAIMENT ---"
ffprobe -v error -select_streams v:0 \
  -show_entries stream=width,height,sample_aspect_ratio,display_aspect_ratio \
  -of default=nw=1 "$ECHANTILLON" | sed 's/^/  /'
echo "--- bandes noires dans l'image ? ---"
UTILE=$(ffmpeg -hide_banner -i "$ECHANTILLON" -vf cropdetect -frames:v 40 -f null - 2>&1 \
  | grep -o 'crop=[0-9]*:[0-9]*' | tail -1)
LU=${UTILE#crop=}
LARG=${STREAM_RESOLUTION%x*}; HAUT=${STREAM_RESOLUTION#*x}
UL=${LU%%:*}; UH=${LU##*:}
if [ -n "$UL" ] && [ "$UL" -gt 0 ] 2>/dev/null; then
  # Quelques pixels sombres au bord d'une vidéo sont normaux ; une bande, c'est autre chose.
  MANQUE=$(( (LARG - UL) * 100 / LARG + (HAUT - UH) * 100 / HAUT ))
  echo "  image utile : ${UL}x${UH} sur ${LARG}x${HAUT}"
  if [ "$MANQUE" -gt 4 ]; then
    echo "  ATTENTION : l'image contient elle-même des bandes noires — c'est la scène, pas le lecteur."
  else
    echo "  pas de bande : l'image remplit le cadre."
  fi
fi
rm -f "$ECHANTILLON"

echo "--- destinations du flux en cours ---"
if [ -f /tmp/lofi-destinations.json ]; then
  cat /tmp/lofi-destinations.json | sed 's/^/  /'
  echo "  (« refusee » = la plateforme a rejeté le flux, elle ne reviendra pas sans relance)"
else
  echo "  /tmp/lofi-destinations.json absent : le tamis n'est pas dans cette image."
  echo "  Reconstruire : docker compose --profile direct build direct"
fi
