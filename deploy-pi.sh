#!/bin/bash
# Construit le site et le déploie sur le Pi, puis vérifie que le service répond.
set -euo pipefail
cd "$(dirname "$0")"

PI_HOST="${PI_HOST:-pi-trinity}"
PI_PATH="${PI_PATH:-/mnt/projects/lofi-engine}"
SERVICE="lofi-engine.service"

echo "[DEPLOY] Construction..."
bun install
bun run build
[ -f dist/index.html ] || { echo "[DEPLOY] ÉCHEC : dist/index.html absent après le build"; exit 1; }

echo "[DEPLOY] Envoi vers $PI_HOST:$PI_PATH"
rsync -az --delete --exclude server.ts dist/ "$PI_HOST:$PI_PATH/"
rsync -az server.ts "$PI_HOST:$PI_PATH/server.ts"

echo "[DEPLOY] Redémarrage du service"
ssh "$PI_HOST" "sudo systemctl restart $SERVICE"
sleep 4

CODE=$(ssh "$PI_HOST" "curl -s -o /dev/null -m 10 -w '%{http_code}' http://127.0.0.1:8794/")
echo "[DEPLOY] Réponse locale sur le Pi : HTTP $CODE"
[ "$CODE" = "200" ] || { echo "[DEPLOY] ÉCHEC : le service ne répond pas correctement"; exit 1; }

PUBLIC=$(curl -s -o /dev/null -m 20 -w '%{http_code}' https://lofi.christophercouspeyre.com/)
echo "[DEPLOY] Réponse publique : HTTP $PUBLIC"
[ "$PUBLIC" = "200" ] || { echo "[DEPLOY] AVERTISSEMENT : la façade publique renvoie $PUBLIC"; exit 1; }

echo "[DEPLOY] Déployé et vérifié"
