#!/bin/bash
# Détecte, côté hôte, le matériel d'encodage utilisable par le conteneur de diffusion,
# et imprime ce qu'il faut ajouter à la commande docker compose. Sourcé ou exécuté.
#
# Sortie : des lignes CLE=VALEUR, lisibles aussi bien par bash que par le centre de contrôle.
#   MATERIEL   : nvidia | dri | aucun — ce qui a été trouvé
#   OVERRIDES  : fichiers compose à ajouter, séparés par des espaces (peut être vide)
#   GID_RENDER : groupe propriétaire de /dev/dri/renderD*, que le conteneur doit rejoindre
#
# Ce fichier ne décide QUE de l'accès au matériel. Le choix de l'encodeur se fait dans le
# conteneur, par un essai réel — voir choisir_encodeur() dans direct.sh.
set -uo pipefail

materiel="aucun"
overrides=""
gid_render=""

# NVIDIA : il faut à la fois une carte et le pont qui l'expose à Docker.
if command -v nvidia-smi >/dev/null 2>&1 && nvidia-smi -L >/dev/null 2>&1 \
   && { command -v nvidia-container-runtime >/dev/null 2>&1 || command -v nvidia-ctk >/dev/null 2>&1; }; then
  materiel="nvidia"
  overrides="docker-compose.nvidia.yml"
fi

# Intel / AMD : le nœud de rendu suffit, mais le conteneur ne tourne pas en root — il lui
# faut le groupe propriétaire du périphérique, dont le numéro change d'une machine à l'autre.
if [ "$materiel" = "aucun" ]; then
  noeud=$(ls /dev/dri/renderD* 2>/dev/null | head -1)
  if [ -n "$noeud" ]; then
    materiel="dri"
    overrides="docker-compose.dri.yml"
    gid_render=$(stat -c '%g' "$noeud" 2>/dev/null)
  fi
fi

echo "MATERIEL=${materiel}"
echo "OVERRIDES=${overrides}"
echo "GID_RENDER=${gid_render}"
