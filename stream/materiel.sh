#!/bin/bash
# Détecte, côté hôte, le matériel d'encodage utilisable par le conteneur de diffusion,
# et imprime ce qu'il faut ajouter à la commande docker compose. Sourcé ou exécuté.
#
# Sortie : des lignes CLE=VALEUR sur une seule ligne chacune, lisibles aussi bien par bash
# que par le centre de contrôle.
#   MATERIEL    : nvidia | dri | aucun — ce qui a été trouvé
#   OVERRIDES   : fichiers compose à ajouter, séparés par des espaces (peut être vide)
#   GID_RENDER  : groupe propriétaire de /dev/dri/renderD*, que le conteneur doit rejoindre
#   NOEUD_RENDU : le nœud de rendu réellement présent — il n'est pas toujours renderD128
#   PUCE        : la puce vidéo vue sur le bus PCI, même inutilisable
#   CAUSE       : pourquoi il n'y a pas d'encodage matériel (vide quand il y en a)
#   REMEDE      : ce qu'il faut faire pour en avoir (vide quand il y en a)
#
# Dire « aucun » sans dire pourquoi ne suffit pas : la même réponse recouvre trois situations
# qui n'ont pas le même remède — pas de puce du tout, une puce que le noyau n'expose pas
# (le cas d'une machine virtuelle), et une puce exposée que le conteneur ne peut pas ouvrir.
#
# Ce fichier ne décide QUE de l'accès au matériel. Le choix de l'encodeur se fait dans le
# conteneur, par un essai réel — voir choisir_encodeur() dans direct.sh.
set -uo pipefail

# Les deux racines système sont paramétrables pour une seule raison : pouvoir rejouer, sur une
# machine qui a une carte, le diagnostic d'une machine qui n'en a pas. Sans ça les branches
# « pas de puce » et « puce invisible » ne seraient jamais exécutées avant d'atterrir chez
# quelqu'un. En usage normal, ne rien passer.
RACINE_SYS="${RACINE_SYS:-/sys}"
RACINE_DEV="${RACINE_DEV:-/dev}"

materiel="aucun"
overrides=""
gid_render=""
noeud_rendu=""
puce=""
cause=""
remede=""

# La puce vidéo se lit sur le bus PCI, sans lspci : le classeur 0x0300 est un contrôleur
# d'affichage, 0x0380 un contrôleur vidéo secondaire. Un identifiant de constructeur suffit
# à nommer la famille, et c'est tout ce dont on a besoin pour orienter le diagnostic.
detecter_puce() {
  local dossier classe vendeur
  for dossier in "$RACINE_SYS"/bus/pci/devices/*; do
    [ -r "$dossier/class" ] || continue
    classe=$(cat "$dossier/class" 2>/dev/null)
    case "$classe" in 0x0300*|0x0302*|0x0380*) ;; *) continue ;; esac
    vendeur=$(cat "$dossier/vendor" 2>/dev/null)
    case "$vendeur" in
      0x8086) echo "Intel" ;;
      0x10de) echo "NVIDIA" ;;
      0x1002|0x1022) echo "AMD" ;;
      *) echo "inconnue (${vendeur:-?})" ;;
    esac
    return 0
  done
  return 1
}

puce=$(detecter_puce) || puce=""

# NVIDIA : il faut à la fois une carte et le pont qui l'expose à Docker.
carte_nvidia=false
command -v nvidia-smi >/dev/null 2>&1 && nvidia-smi -L >/dev/null 2>&1 && carte_nvidia=true
pont_nvidia=false
{ command -v nvidia-container-runtime >/dev/null 2>&1 || command -v nvidia-ctk >/dev/null 2>&1; } \
  && pont_nvidia=true

if $carte_nvidia && $pont_nvidia; then
  materiel="nvidia"
  overrides="docker-compose.nvidia.yml"
fi

# Intel / AMD : le nœud de rendu suffit, mais le conteneur ne tourne pas en root — il lui
# faut le groupe propriétaire du périphérique, dont le numéro change d'une machine à l'autre.
if [ "$materiel" = "aucun" ]; then
  noeud_rendu=$(ls "$RACINE_DEV"/dri/renderD* 2>/dev/null | head -1)
  if [ -n "$noeud_rendu" ]; then
    materiel="dri"
    overrides="docker-compose.dri.yml"
    gid_render=$(stat -c '%g' "$noeud_rendu" 2>/dev/null)
  fi
fi

# Nommer ce qui manque. Chaque branche correspond à une action différente de l'utilisateur.
if [ "$materiel" = "aucun" ]; then
  if $carte_nvidia && ! $pont_nvidia; then
    cause="Une carte NVIDIA est présente, mais le pont nvidia-container n'est pas installé : Docker ne peut pas la donner au conteneur."
    remede="Installer nvidia-container-toolkit, puis « sudo nvidia-ctk runtime configure --runtime=docker » et redémarrer Docker."
  elif [ -d "$RACINE_DEV/dri" ]; then
    cause="/dev/dri existe mais ne contient aucun nœud de rendu (renderD*) : seule la sortie écran est exposée, pas le moteur d'encodage."
    remede="Vérifier que le pilote de la puce est bien chargé (i915 pour Intel, amdgpu pour AMD) : « lsmod | grep -E 'i915|amdgpu' »."
  elif [ -n "$puce" ]; then
    cause="Une puce vidéo ${puce} est présente sur le bus PCI, mais le noyau ne l'expose pas : /dev/dri n'existe pas. C'est la signature d'une machine virtuelle, ou d'un pilote absent."
    remede="Sur Proxmox, un conteneur LXC voit le /dev/dri de l'hôte, une machine virtuelle non : déplacer la diffusion dans un LXC est le chemin court. Sinon, passer la puce en PCI à la VM. Sur une machine physique, charger le pilote (i915 pour Intel, amdgpu pour AMD)."
  else
    cause="Aucune puce vidéo sur le bus PCI de cette machine : l'encodage restera logiciel."
    remede="Rien à faire ici. En 1080p logiciel, compter environ six cœurs — le garde-fou abaisse sinon la définition à 1280x720."
  fi
fi

echo "MATERIEL=${materiel}"
echo "OVERRIDES=${overrides}"
echo "GID_RENDER=${gid_render}"
echo "NOEUD_RENDU=${noeud_rendu}"
echo "PUCE=${puce}"
echo "CAUSE=${cause}"
echo "REMEDE=${remede}"
