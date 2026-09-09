# Centre de contrôle du stream : interface d'administration locale.
# Tourne hors conteneur — il pilote Docker et écrit le .env du projet, lui donner
# le socket Docker dans un conteneur reviendrait à lui donner la machine.
# Sourcé par start.sh et stop.sh.

CONTROLE_DIR="./stream/controle"
CONTROLE_PORT="${CONTROLE_PORT:-4708}"
CONTROLE_PID="./logs/controle.pid"
CONTROLE_LOG="./logs/controle.log"

controle_erreur() { printf '[CONTRÔLE] %s\n' "$*" >&2; }

expliquer_absence_bun() {
  controle_erreur "Bun est requis pour le centre de contrôle. Installation :"
  controle_erreur "  curl -fsSL https://bun.sh/install | bash"
  controle_erreur "Le site et la diffusion fonctionnent sans lui ; seule l'interface manquera."
}

# Construit l'interface si le bundle est absent ou plus vieux que les sources.
construire_ui_si_besoin() {
  local dist="$CONTROLE_DIR/ui/dist/index.html"
  [ -d "$CONTROLE_DIR/ui" ] || return 1
  if [ -f "$dist" ] && [ -z "$(find "$CONTROLE_DIR/ui" -name '*.tsx' -newer "$dist" -print -quit)" ]; then
    return 0
  fi
  echo "[CONTRÔLE] Construction de l'interface..."
  ( cd "$CONTROLE_DIR" && bun install --silent && bun run build-ui ) >>"$CONTROLE_LOG" 2>&1
}

# Un PID ne prouve pas que le serveur écoute : on attend une vraie réponse.
attendre_controle() {
  local i
  for ((i = 1; i <= 30; i++)); do
    curl -sf -o /dev/null -m 2 "http://127.0.0.1:$CONTROLE_PORT/api/etat" 2>/dev/null && return 0
    if ! kill -0 "$(cat "$CONTROLE_PID" 2>/dev/null)" 2>/dev/null; then
      controle_erreur "Le centre de contrôle s'est arrêté au démarrage :"
      tail -15 "$CONTROLE_LOG" >&2
      rm -f "$CONTROLE_PID"
      return 1
    fi
    sleep 1
  done
  controle_erreur "Pas de réponse sur le port $CONTROLE_PORT après 30 s — voir $CONTROLE_LOG"
  return 1
}

demarrer_controle() {
  mkdir -p ./logs
  : > "$CONTROLE_LOG"
  if ! command -v bun >/dev/null 2>&1; then
    expliquer_absence_bun
    return 1
  fi
  if ! construire_ui_si_besoin; then
    controle_erreur "Construction de l'interface échouée — voir $CONTROLE_LOG"
    tail -15 "$CONTROLE_LOG" >&2
    return 1
  fi

  ( cd "$CONTROLE_DIR" \
    && RACINE_PROJET="$(cd ../.. && pwd)" \
       CORPUS_DIR="$(cd ../.. && pwd)/corpus" \
       SCENE_FICHIER="$(cd ../.. && pwd)/corpus/scene.json" \
       CONTROLE_PORT="$CONTROLE_PORT" \
       bun run serveur.ts ) >>"$CONTROLE_LOG" 2>&1 &
  echo $! > "$CONTROLE_PID"

  attendre_controle
}

arreter_controle() {
  [ -f "$CONTROLE_PID" ] || return 0
  local pid
  pid=$(cat "$CONTROLE_PID")
  # Arrêt par PID enregistré, jamais par motif de nom
  if kill "$pid" 2>/dev/null; then
    local i
    for ((i = 1; i <= 10; i++)); do
      kill -0 "$pid" 2>/dev/null || break
      sleep 1
    done
    kill -9 "$pid" 2>/dev/null
    echo "[CONTRÔLE] Centre de contrôle arrêté (PID $pid)"
  fi
  rm -f "$CONTROLE_PID"
}
