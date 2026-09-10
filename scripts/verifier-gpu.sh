#!/usr/bin/env bash
# Vérifie que cette machine peut encoder sur sa puce vidéo, et propose de combler ce qui manque.
#
# À lancer là où tourne la diffusion — dans le conteneur LXC, la VM ou sur la machine physique,
# jamais sur l'hôte Proxmox. Chaque manque trouvé est expliqué, puis proposé à la correction par
# un « o / n ». Rien n'est modifié sans réponse.
#
# La distinction qui commande tout le reste : dans un conteneur LXC, une partie des correctifs
# n'est pas applicable depuis l'intérieur — le périphérique est donné par l'hôte, le pilote est
# chargé par le noyau de l'hôte. Le script ne fait pas semblant : il rend les lignes exactes à
# coller dans la configuration du conteneur, côté Proxmox.
#
#   ./scripts/verifier-gpu.sh              vérifie et propose
#   ./scripts/verifier-gpu.sh --lire-seul  vérifie sans jamais rien proposer
#
# Code de sortie : 0 si l'encodage matériel fonctionne à la fin, 1 sinon.
set -uo pipefail

# Paramétrables pour rejouer, sur une machine équipée, le diagnostic d'une machine qui ne l'est
# pas. En usage normal, ne rien passer.
RACINE_SYS="${RACINE_SYS:-/sys}"
RACINE_DEV="${RACINE_DEV:-/dev}"

LIRE_SEUL=false
[ "${1:-}" = "--lire-seul" ] && LIRE_SEUL=true

RACINE_PROJET="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
manques=0               # ce qui reste cassé à la fin
materiel_projet="aucun" # ce que le projet déduira, renseigné à l'étape 9
lieu=""                 # lxc | vm | physique
noeud=""                # le nœud de rendu, quand il existe
puce=""                 # Intel | NVIDIA | AMD | vide

# ------------------------------------------------------------------ affichage

titre()   { printf '\n\033[1m%s\033[0m\n' "$*"; }
bon()     { printf '  \033[32m✓\033[0m %s\n' "$*"; }
manque()  { printf '  \033[31m✗\033[0m %s\n' "$*"; manques=$((manques + 1)); }
note()    { printf '    %s\n' "$*"; }

# Demande, montre ce qui sera lancé, puis lance. Toute autre réponse que « o » vaut non.
proposer() {
  local question="$1"; shift
  if $LIRE_SEUL; then
    note "correction possible : $*"
    return 1
  fi
  if [ ! -t 0 ]; then
    note "correction possible, mais l'entrée n'est pas un terminal : $*"
    return 1
  fi
  printf '    → %s\n' "$question"
  printf '      commande : %s\n' "$*"
  local reponse
  read -r -p "      corriger ? [o/n] " reponse
  printf '\n'
  [ "$reponse" = "o" ] || [ "$reponse" = "O" ] || return 1
  "$@"
}

# Lance en administrateur, ou explique pourquoi c'est impossible.
admin() {
  if [ "$(id -u)" = "0" ]; then "$@"; return $?; fi
  if command -v sudo >/dev/null 2>&1; then sudo "$@"; return $?; fi
  note "ni root ni sudo : impossible de lancer « $* »"
  return 1
}

# ------------------------------------------------------- 1. où tourne-t-on

situer_machine() {
  titre "1. Où tourne cette machine"
  local conteneur="" virtuel=""
  if command -v systemd-detect-virt >/dev/null 2>&1; then
    conteneur=$(systemd-detect-virt -c 2>/dev/null)
    virtuel=$(systemd-detect-virt -v 2>/dev/null)
  fi
  [ "$conteneur" = "none" ] && conteneur=""
  [ "$virtuel" = "none" ] && virtuel=""

  if [ "$conteneur" = "lxc" ]; then
    lieu="lxc"
    bon "conteneur LXC. Il voit le matériel de son hôte, à condition que l'hôte le lui passe."
  elif [ -n "$conteneur" ]; then
    lieu="lxc"
    bon "conteneur ($conteneur) — même logique qu'un LXC : le périphérique vient de l'hôte."
  elif [ -n "$virtuel" ]; then
    lieu="vm"
    manque "machine virtuelle ($virtuel). Une VM ne voit PAS la puce vidéo de son hôte."
    note "C'est la cause la plus fréquente d'un encodage resté logiciel. Deux issues :"
    note "  · déplacer la diffusion dans un conteneur LXC, qui voit le /dev/dri de l'hôte ;"
    note "  · passer la puce en PCI à cette VM, ce qui la retire à l'hôte."
    note "Aucune des deux ne se fait depuis l'intérieur de la VM."
  else
    lieu="physique"
    bon "machine physique. Tous les correctifs sont applicables ici."
  fi
}

# ------------------------------------------------------- 2. la puce vidéo

nommer_vendeur() {
  case "$1" in
    0x8086) echo "Intel" ;;
    0x10de) echo "NVIDIA" ;;
    0x1002|0x1022) echo "AMD" ;;
    *) echo "inconnue (${1:-?})" ;;
  esac
}

verifier_puce() {
  titre "2. La puce vidéo"
  local dossier classe
  # Même ordre de préférence que materiel.sh : une carte NVIDIA qui répond l'emporte sur ce
  # que porte le bus. Sans ça, sur une machine à deux puces, ce script éprouverait VAAPI
  # pendant que la diffusion partirait sur NVENC — deux diagnostics d'une seule machine.
  if command -v nvidia-smi >/dev/null 2>&1 && nvidia-smi -L >/dev/null 2>&1; then
    puce="NVIDIA"
    bon "carte NVIDIA active — c'est elle que la diffusion utilisera."
    return 0
  fi
  for dossier in "$RACINE_SYS"/bus/pci/devices/*; do
    [ -r "$dossier/class" ] || continue
    classe=$(cat "$dossier/class" 2>/dev/null)
    case "$classe" in 0x0300*|0x0302*|0x0380*) ;; *) continue ;; esac
    puce=$(nommer_vendeur "$(cat "$dossier/vendor" 2>/dev/null)")
    break
  done
  if [ -z "$puce" ]; then
    manque "aucune puce vidéo sur le bus PCI."
    [ "$lieu" = "vm" ] && note "Cohérent : la VM n'en a pas reçu."
    note "Sans puce, l'encodage reste logiciel — compter six cœurs pour du 1080p."
    return 1
  fi
  bon "puce $puce vue sur le bus PCI."
  return 0
}

# ------------------------------------------------------- 3. le pilote noyau

module_attendu() {
  case "$puce" in Intel) echo "i915" ;; AMD) echo "amdgpu" ;; *) echo "" ;; esac
}

charger_module() {
  local module="$1"
  admin modprobe "$module" || return 1
  # Sans ça, il faudrait le recharger à chaque démarrage.
  admin bash -c "echo $module > /etc/modules-load.d/lofi-gpu.conf" || return 1
  return 0
}

verifier_pilote() {
  local module; module=$(module_attendu)
  titre "3. Le pilote noyau"
  [ -n "$module" ] || { bon "rien à vérifier pour une puce $puce."; return 0; }
  if grep -qw "$module" /proc/modules 2>/dev/null; then
    bon "$module chargé."
    return 0
  fi
  manque "$module n'est pas chargé : le noyau n'expose donc aucun moteur d'encodage."
  if [ "$lieu" != "physique" ]; then
    note "Le noyau appartient à l'hôte : ce module se charge là-bas, pas ici."
    return 1
  fi
  proposer "charger $module maintenant et à chaque démarrage" charger_module "$module" || return 1
  grep -qw "$module" /proc/modules 2>/dev/null && { bon "$module chargé."; manques=$((manques - 1)); }
  return 0
}

# ------------------------------------------------------- 4. le nœud de rendu

# Ce qu'il faut faire côté hôte. On n'imprime plus de recette à recopier : les numéros des
# groupes « video » et « render » changent d'une machine à l'autre — 104 sur Debian, 993 sur
# Proxmox — et un mappage bâti sur les mauvais numéros EMPÊCHE le conteneur de démarrer.
# Mesuré le 2026-09-10 sur l'installation d'un utilisateur : « newgidmap failed to write
# mapping, gid range [44-45] not allowed », conteneur mort. Le script d'hôte lit les vrais
# numéros sur la machine où il tourne, ce qu'aucune recette écrite d'avance ne peut faire.
marche_a_suivre_hote() {
  note "Sur l'HÔTE Proxmox, pas ici :"
  note "  1. y copier scripts/lxc-gpu-hote.sh de ce dépôt"
  note "  2. bash lxc-gpu-hote.sh <numéro du conteneur>"
  note "     il lit les groupes de la machine, calcule le mappage et demande avant d'écrire"
  note "  3. pct stop <numéro> && pct start <numéro>"
  note "  4. relancer ce script ici : l'étape 4 doit passer au vert"
  note "Si le conteneur ne démarre plus après une tentative manuelle :"
  note "  bash lxc-gpu-hote.sh <numéro> --nettoyer"
  return 0
}

verifier_noeud() {
  titre "4. Le nœud de rendu"
  noeud=$(ls "$RACINE_DEV"/dri/renderD* 2>/dev/null | head -1)
  if [ -n "$noeud" ]; then
    bon "nœud de rendu présent : $noeud"
    [ "$noeud" = "$RACINE_DEV/dri/renderD128" ] \
      || note "Ce n'est pas renderD128 : la valeur est transmise au conteneur par materiel.sh."
    return 0
  fi
  if [ -d "$RACINE_DEV/dri" ]; then
    manque "/dev/dri existe mais ne contient aucun renderD* : seule la sortie écran est exposée."
  else
    manque "/dev/dri n'existe pas : rien n'expose la puce à cette machine."
  fi
  case "$lieu" in
    lxc)
      note "L'hôte doit passer le périphérique au conteneur, et — s'il n'est pas privilégié,"
      note "ce qui est le défaut de Proxmox — mapper le groupe du périphérique. Sans ce"
      note "mappage, il apparaît dans le conteneur sans pouvoir être ouvert."
      marche_a_suivre_hote ;;
    vm) note "Une VM ne recevra jamais ce nœud sans passage PCI de la puce." ;;
    *)  note "Sur une machine physique, c'est le pilote de l'étape 3 qui le crée." ;;
  esac
  return 1
}

# ------------------------------------------------------- 5. les droits d'accès

groupe_du_noeud() { stat -c '%G' "$noeud" 2>/dev/null; }

ajouter_au_groupe() {
  admin usermod -aG "$1" "$(id -un)" || return 1
  note "Il faut rouvrir la session pour que l'appartenance prenne effet."
  return 0
}

verifier_droits() {
  titre "5. Les droits sur le nœud"
  [ -n "$noeud" ] || { note "sans nœud, rien à vérifier."; return 1; }
  if [ -r "$noeud" ] && [ -w "$noeud" ]; then
    bon "$(id -un) peut ouvrir $noeud."
    return 0
  fi
  local groupe gid
  groupe=$(groupe_du_noeud); gid=$(stat -c '%g' "$noeud" 2>/dev/null)
  manque "$(id -un) ne peut pas ouvrir $noeud — il appartient au groupe « ${groupe:-inconnu} »."
  if [ "$gid" = "65534" ] || [ "$groupe" = "nogroup" ]; then
    note "65534 (« nogroup ») signifie que le groupe du périphérique N'EST PAS MAPPÉ dans ce"
    note "conteneur. L'hôte le passe bien, mais son identifiant de groupe ne correspond à rien"
    note "ici — root s'en accommode, un utilisateur normal non, et le conteneur Docker en est un."
    marche_a_suivre_hote
    return 1
  fi
  if [ -z "$groupe" ] || [ "$groupe" = "UNKNOWN" ]; then
    note "Le groupe propriétaire n'existe pas dans cette machine : c'est la signature d'un"
    note "conteneur non privilégié dont l'identifiant de groupe n'est pas mappé. Le mappage"
    note "se règle sur l'hôte (lxc.idmap), ou en rendant le conteneur privilégié."
    return 1
  fi
  proposer "ajouter $(id -un) au groupe $groupe" ajouter_au_groupe "$groupe" || return 1
  return 0
}

# ------------------------------------------------------- 6. VAAPI répond-il

installer_paquets() { admin apt-get install -y "$@"; }

# L'essai suit la puce. Éprouver VAAPI sur une carte NVIDIA échoue toujours, et fait conclure
# à une panne sur une machine parfaitement câblée — un vérificateur qui invente des manques
# est pire que pas de vérificateur.
voie_encodage() {
  case "$puce" in NVIDIA) echo "nvenc" ;; Intel|AMD) echo "vaapi" ;; *) echo "" ;; esac
}

# Les arguments ffmpeg de l'essai, selon la voie. Le même profil que la diffusion.
args_essai() {
  case "$1" in
    nvenc) printf '%s\n' -c:v h264_nvenc -preset p4 -pix_fmt yuv420p ;;
    vaapi) printf '%s\n' -vaapi_device "$noeud" -vf format=nv12,hwupload -c:v h264_vaapi ;;
  esac
}

# Le seul essai qui vaille : encoder pour de vrai, une image, avec le profil de la diffusion.
essai_encodeur() {
  local args=(); mapfile -t args < <(args_essai "$1")
  [ ${#args[@]} -gt 0 ] || return 1
  ffmpeg -hide_banner -loglevel error -nostdin \
    -f lavfi -i "color=c=black:s=1280x720:r=30" -frames:v 1 \
    "${args[@]}" -f null - >/dev/null 2>&1
}

# Les mêmes paquets que ceux embarqués dans l'image du diffuseur. La variante « non-free »
# d'intel-media n'est pas dans les dépôts par défaut de Debian : la proposer donnait
# « has no installation candidate », mesuré chez un utilisateur le 2026-09-10.
paquets_pilote() {
  case "$puce" in
    Intel) printf '%s\n' vainfo intel-media-va-driver i965-va-driver ;;
    AMD)   printf '%s\n' vainfo mesa-va-drivers ;;
  esac
}

verifier_encodage() {
  local voie; voie=$(voie_encodage)
  titre "6. L'encodage matériel sur cette machine"
  [ -n "$voie" ] || { note "aucune voie matérielle connue pour une puce ${puce:-absente}."; return 1; }
  [ "$voie" = "nvenc" ] || [ -n "$noeud" ] || { note "sans nœud de rendu, rien à essayer."; return 1; }
  if ! command -v ffmpeg >/dev/null 2>&1; then
    manque "ffmpeg absent de cette machine : impossible d'éprouver l'encodage."
    proposer "installer ffmpeg" installer_paquets ffmpeg || return 1
  fi
  if essai_encodeur "$voie"; then
    bon "$voie encode sur cette machine."
    note "Attention : cela ne dit rien du conteneur, qui a ses propres pilotes — voir l'étape 8."
    return 0
  fi
  manque "$voie ne parvient pas à encoder sur cette machine."
  if [ "$voie" = "nvenc" ]; then
    note "La carte répond mais ffmpeg n'a pas l'encodeur : construction sans nvenc, ou pilote"
    note "trop ancien pour cette version de ffmpeg."
    return 1
  fi
  note "Le nœud est là, mais le pilote d'espace utilisateur manque ou ne convient pas."
  local paquets=(); mapfile -t paquets < <(paquets_pilote)
  [ ${#paquets[@]} -gt 0 ] || return 1
  proposer "installer le pilote VAAPI de l'espace utilisateur" installer_paquets "${paquets[@]}" \
    || return 1
  if essai_encodeur "$voie"; then
    bon "VAAPI encode maintenant sur $noeud."
    manques=$((manques - 1))
    return 0
  fi
  note "Toujours pas. « vainfo » dira quels profils la puce déclare."
  return 1
}

# ------------------------------------------------------- 7. NVIDIA et Docker

installer_pont_nvidia() {
  admin bash -c 'curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey \
    | gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg' || return 1
  admin bash -c 'curl -fsSL https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list \
    | sed "s#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g" \
    > /etc/apt/sources.list.d/nvidia-container-toolkit.list' || return 1
  admin apt-get update || return 1
  admin apt-get install -y nvidia-container-toolkit || return 1
  admin nvidia-ctk runtime configure --runtime=docker || return 1
  admin systemctl restart docker || return 1
  return 0
}

verifier_nvidia() {
  titre "7. Le pont NVIDIA vers Docker"
  [ "$puce" = "NVIDIA" ] || { bon "pas de carte NVIDIA ici : rien à ponter."; return 0; }
  if ! command -v nvidia-smi >/dev/null 2>&1 || ! nvidia-smi -L >/dev/null 2>&1; then
    manque "carte NVIDIA sur le bus, mais le pilote ne répond pas ici."
    [ "$lieu" != "physique" ] && note "Dans un conteneur, le pilote vient de l'hôte."
    return 1
  fi
  bon "le pilote NVIDIA répond."
  if command -v nvidia-ctk >/dev/null 2>&1 || command -v nvidia-container-runtime >/dev/null 2>&1; then
    bon "le pont nvidia-container est installé : Docker peut transmettre la carte."
    return 0
  fi
  manque "le pont nvidia-container manque : Docker voit la carte mais ne peut pas la donner."
  proposer "installer nvidia-container-toolkit et l'inscrire dans Docker" installer_pont_nvidia \
    || return 1
  return 0
}

# Exactement les options que les fichiers compose du dépôt donnent au conteneur : éprouver
# autre chose ne dirait rien du chemin réel.
acces_docker() {
  if [ "$1" = "nvenc" ]; then
    printf '%s\n' --gpus all
  else
    printf '%s\n' --device /dev/dri:/dev/dri --group-add "${2:-104}"
  fi
}

# Le vrai point de consommation : le conteneur de diffusion, avec le périphérique et le groupe.
verifier_docker() {
  titre "8. Docker transmet-il le périphérique"
  command -v docker >/dev/null 2>&1 || { manque "docker absent : la diffusion ne tournera pas."; return 1; }
  docker info >/dev/null 2>&1 || { manque "le démon Docker ne répond pas à $(id -un)."; return 1; }
  [ -n "$noeud" ] || { note "sans nœud, rien à transmettre."; return 1; }

  local image="lofi-navigateur:local" voie; voie=$(voie_encodage)
  if ! docker image inspect "$image" >/dev/null 2>&1; then
    note "L'image $image n'est pas encore construite : essai remis à sa première mise en route."
    return 0
  fi
  local acces=() gid
  gid=$(stat -c '%g' "$noeud" 2>/dev/null)
  mapfile -t acces < <(acces_docker "$voie" "$gid")
  local args=(); mapfile -t args < <(args_essai "$voie")
  [ ${#args[@]} -gt 0 ] || { note "aucune voie matérielle à éprouver ici."; return 1; }
  if docker run --rm "${acces[@]}" "$image" \
       ffmpeg -hide_banner -loglevel error -nostdin \
       -f lavfi -i "color=c=black:s=1280x720:r=30" -frames:v 1 \
       "${args[@]}" -f null - >/dev/null 2>&1; then
    bon "le conteneur de diffusion encode sur la puce. C'est le chemin réel, pas un substitut."
    return 0
  fi
  manque "le conteneur ne parvient pas à encoder, alors que la machine y arrive."
  note "C'est CETTE étape qui compte : la machine et le conteneur n'ont pas les mêmes pilotes."
  if [ "$voie" = "nvenc" ]; then
    note "Le pont nvidia-container est installé mais ne transmet pas la carte : vérifier que"
    note "« nvidia-ctk runtime configure » a bien été passé, et que Docker a redémarré depuis."
  else
    note "Deux causes possibles, dans cet ordre :"
    note "  · le pilote VAAPI manque dans l'image — libva seul ne suffit pas, il faut un"
    note "    pilote (iHD, i965, radeonsi). Vérifier : docker run --rm lofi-navigateur:local"
    note "    ls /usr/lib/x86_64-linux-gnu/dri/ — si le répertoire n'existe pas, reconstruire."
    if [ "${gid:-}" = "65534" ]; then
      note "  · le groupe du nœud vaut 65534 (« nogroup ») : il n'est PAS mappé dans ce"
      note "    conteneur LXC. C'est la cause la plus probable ici — voir l'étape 5."
    else
      note "  · le groupe ${gid:-?} propriétaire du nœud, que le conteneur doit rejoindre."
    fi
  fi
  return 1
}

# ------------------------------------------------------- 9. le projet lui-même

verifier_projet() {
  titre "9. Ce que le projet en déduit"
  local detecteur="$RACINE_PROJET/stream/materiel.sh"
  [ -f "$detecteur" ] || { manque "$detecteur introuvable : lancé hors du dépôt ?"; return 1; }
  local sortie
  sortie=$(RACINE_SYS="$RACINE_SYS" RACINE_DEV="$RACINE_DEV" bash "$detecteur" 2>/dev/null)
  local trouve; trouve=$(printf '%s\n' "$sortie" | sed -n 's/^MATERIEL=//p')
  materiel_projet="${trouve:-aucun}"
  case "$trouve" in
    nvidia) bon "la diffusion partira sur NVENC." ;;
    dri)    bon "la diffusion partira sur VAAPI, via $(printf '%s\n' "$sortie" | sed -n 's/^NOEUD_RENDU=//p')." ;;
    *)      manque "le projet ne voit aucun encodeur matériel."
            printf '%s\n' "$sortie" | sed -n 's/^CAUSE=/    cause  : /p'
            printf '%s\n' "$sortie" | sed -n 's/^REMEDE=/    remède : /p' ;;
  esac
  [ "$trouve" = "aucun" ] && return 1
  return 0
}

# ------------------------------------------------------- conclusion

conclure() {
  titre "Conclusion"
  if [ "$manques" -eq 0 ]; then
    printf '  \033[32mTout est câblé.\033[0m La diffusion encodera sur la puce vidéo.\n\n'
    return 0
  fi
  printf '  \033[31m%d point(s) à régler.\033[0m\n' "$manques"
  case "$lieu" in
    vm) note "Le premier reste le même : une machine virtuelle ne voit pas la puce de son hôte." ;;
    lxc) note "Ce qui touche au périphérique et au pilote se règle sur l'hôte Proxmox, pas ici." ;;
  esac
  if [ "$materiel_projet" = "aucun" ]; then
    note "La diffusion reste utilisable sans puce : elle tombe d'elle-même en 1280x720."
  else
    note "La diffusion, elle, encodera bien sur la puce : ce qui reste ci-dessus ne la bloque pas."
  fi
  printf '\n'
  return 1
}

printf '\033[1mAccès à la puce vidéo — vérification\033[0m\n'
$LIRE_SEUL && printf 'Mode lecture seule : rien ne sera modifié.\n'

situer_machine
verifier_puce && verifier_pilote
verifier_noeud
verifier_droits
verifier_encodage
verifier_nvidia
verifier_docker
verifier_projet
conclure
