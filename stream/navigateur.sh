# Environnement navigateur : écran virtuel, serveur audio, puits de capture.
# Sourcé par le générateur de corpus et par le mode direct. Jamais exécuté seul.
#
# Un navigateur sans affichage n'émet aucun son : d'où l'écran virtuel. Le puits audio
# virtuel donne à ffmpeg une source à lire, sans toucher au système hôte.

ECRAN="${ECRAN:-1280x720x24}"
SINK="${SINK:-lofi}"
SILENCE_SEUIL="${SILENCE_SEUIL:--70}"   # dBFS
NAVIGATEUR_PID=""

# attendre <quoi> <secondes max> <commande de test>
attendre() {
  local quoi="$1" max="$2" test="$3" i=0
  while [ "$i" -lt "$max" ]; do
    if eval "$test"; then return 0; fi
    i=$((i + 1)); sleep 1
  done
  journal "délai dépassé en attendant : $quoi (${max}s)"
  return 1
}

demarrer_environnement() {
  export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/tmp/runtime-capteur}"
  mkdir -p "$XDG_RUNTIME_DIR" && chmod 700 "$XDG_RUNTIME_DIR"
  export DISPLAY=":99"

  Xvfb "$DISPLAY" -screen 0 "$ECRAN" -nolisten tcp >/tmp/xvfb.log 2>&1 &
  attendre "serveur graphique" 20 '[ -e /tmp/.X11-unix/X99 ]'

  pulseaudio --start --exit-idle-time=-1 --log-target=file:/tmp/pulse.log 2>/dev/null
  attendre "serveur audio" 20 'pactl info >/dev/null 2>&1' \
    || echec "pulseaudio ne répond pas (voir /tmp/pulse.log)"

  pactl load-module module-null-sink sink_name="$SINK" \
        sink_properties=device.description=lofi >/dev/null \
    || echec "impossible de créer le puits audio virtuel"
  pactl set-default-sink "$SINK" || echec "impossible de sélectionner le puits $SINK"
  journal "environnement prêt — écran $ECRAN, puits $SINK"
}

demarrer_navigateur() {
  local url="$1"
  journal "ouverture de $url"
  chromium \
    --no-sandbox --disable-dev-shm-usage --disable-gpu \
    --autoplay-policy=no-user-gesture-required \
    --user-data-dir=/tmp/chromium-profil \
    --window-size="${ECRAN%x*}" --start-maximized \
    --no-first-run --no-default-browser-check --disable-translate \
    "$url" >/tmp/chromium.log 2>&1 &
  NAVIGATEUR_PID=$!
  sleep 3
  kill -0 "$NAVIGATEUR_PID" 2>/dev/null \
    || echec "le navigateur s'est arrêté (voir /tmp/chromium.log)"
  journal "navigateur démarré (PID $NAVIGATEUR_PID)"
}

arreter_navigateur() {
  [ -n "$NAVIGATEUR_PID" ] || return 0
  kill "$NAVIGATEUR_PID" 2>/dev/null
  # kill par PID enregistré, jamais par motif de nom : un pkill emporterait les voisins
  local i=0
  while [ "$i" -lt 10 ] && kill -0 "$NAVIGATEUR_PID" 2>/dev/null; do i=$((i + 1)); sleep 1; done
  kill -9 "$NAVIGATEUR_PID" 2>/dev/null
  NAVIGATEUR_PID=""
  rm -rf /tmp/chromium-profil
}

# Niveau moyen en dBFS de la sortie audio, mesuré sur <secondes>. Vide si illisible.
mesurer_niveau() {
  ffmpeg -hide_banner -nostats -f pulse -i "${SINK}.monitor" \
         -t "$1" -af volumedetect -f null - 2>&1 \
    | grep -oP 'mean_volume:\s*\K-?[0-9.]+' | tail -1
}

# Vrai si le niveau mesuré sur <secondes> est au-dessus du seuil de silence.
il_y_a_du_son() {
  local niveau
  niveau=$(mesurer_niveau "$1")
  [ -n "$niveau" ] || return 1
  awk -v n="$niveau" -v s="$SILENCE_SEUIL" 'BEGIN{exit (n < s)}'
}
