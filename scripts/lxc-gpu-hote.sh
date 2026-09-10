#!/usr/bin/env bash
# Donne la puce vidéo de l'hôte Proxmox à un conteneur LXC. À lancer SUR L'HÔTE, pas dedans.
#
#   ./lxc-gpu-hote.sh <numéro du conteneur>     ajoute le passage de la puce
#   ./lxc-gpu-hote.sh <numéro> --nettoyer       retire ce qu'il a ajouté, et répare un
#                                               fichier de configuration cassé
#
# Ce script existe parce qu'une recette écrite à la main ne marche pas ici : les numéros des
# groupes « video » et « render » changent d'une installation à l'autre — 104 sur Debian, 993
# sur Proxmox — et un mappage calculé sur les mauvais numéros empêche le conteneur de démarrer.
# Il les lit sur la machine plutôt que de les supposer.
#
# Rien n'est écrit sans confirmation, et le fichier de configuration est sauvegardé avant.
set -uo pipefail

NUMERO="${1:-}"
MODE="${2:-ajouter}"
# Paramétrables pour rejouer le scénario sur une machine qui n'est pas un hôte Proxmox : le
# mode --nettoyer répare un conteneur qui ne démarre plus, il ne se teste pas en production.
RACINE_PVE="${RACINE_PVE:-/etc/pve/lxc}"
CONF="${RACINE_PVE}/${NUMERO}.conf"
SUBGID="${FICHIER_SUBGID:-/etc/subgid}"
# Hors de /etc/pve : ce système de fichiers n'accepte que les fichiers que Proxmox connaît.
RACINE_SAUVEGARDE="${RACINE_SAUVEGARDE:-/root}"
GID_MAX=65536

# Tout ce que cet outil pose, et rien d'autre : le mappage, le passage de /dev/dri, la règle
# de périphérique 226 (celle des cartes graphiques), et les commandes shell collées par erreur
# dans un fichier qui n'admet que de la configuration. Les autres règles de périphérique de
# l'utilisateur ne sont pas touchées.
MOTIF_GERE='^[[:space:]]*(lxc\.idmap|lxc\.cgroup2?\.devices\.allow:[[:space:]]*c[[:space:]]*226:|lxc\.mount\.entry:[[:space:]]*/dev/dri|#?[[:space:]]*echo )'

titre() { printf '\n\033[1m%s\033[0m\n' "$*"; }
bon()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
mal()   { printf '  \033[31m✗\033[0m %s\n' "$*"; }
note()  { printf '    %s\n' "$*"; }

if [ -z "$NUMERO" ] || ! [[ "$NUMERO" =~ ^[0-9]+$ ]]; then
  printf 'Usage : %s <numéro du conteneur> [--nettoyer]\n' "$0" >&2
  printf '  « pct list » donne les numéros.\n' >&2
  exit 1
fi
[ -f "$CONF" ] || { printf '%s introuvable — ce numéro existe-t-il ?\n' "$CONF" >&2; exit 1; }

demander() {
  local reponse
  printf '    → %s\n' "$1"
  read -r -p "      continuer ? [o/n] " reponse
  printf '\n'
  [ "$reponse" = "o" ] || [ "$reponse" = "O" ]
}

sauvegarder() {
  local copie="${RACINE_SAUVEGARDE}/lxc-${NUMERO}.conf.avant-gpu-$(date +%Y%m%d-%H%M%S)"
  cp "$CONF" "$copie" || return 1
  note "sauvegarde : $copie"
  return 0
}

# ------------------------------------------------------------------ nettoyage

# Répare un fichier de configuration qui empêche le conteneur de démarrer : les lignes de
# mappage ajoutées par erreur, et les commandes shell collées là où seule de la configuration
# est admise — « unable to parse config: echo 'root:44:1' >> /etc/subgid ».
nettoyer() {
  titre "Nettoyage de $CONF"
  local suspectes
  suspectes=$(grep -nE "$MOTIF_GERE" "$CONF" 2>/dev/null)
  if [ -z "$suspectes" ]; then
    bon "rien à retirer : ni mappage, ni commande collée."
    return 0
  fi
  printf '  Lignes qui seront retirées :\n'
  printf '%s\n' "$suspectes" | sed 's/^/      /'
  demander "retirer ces lignes" || { note "rien fait."; return 1; }
  sauvegarder || { mal "sauvegarde impossible — rien touché."; return 1; }
  grep -vE "$MOTIF_GERE" "$CONF" > "${CONF}.neuf" \
    && mv "${CONF}.neuf" "$CONF" || { mal "réécriture impossible."; return 1; }
  bon "fichier nettoyé. « pct start $NUMERO » devrait repartir (sans la puce)."
  return 0
}

# ------------------------------------------------------------- lecture des gid

gid_de() { getent group "$1" | cut -d: -f3; }

# Le mappage couvre les 65 536 groupes en laissant passer, à l'identique, ceux de la liste.
# Chaque trou est calculé à partir du précédent : une plage qui en recouvre une autre, ou un
# total qui ne fait pas 65 536, et le conteneur refuse de démarrer.
construire_idmap() {
  local passants=("$@") precedent=0 g
  printf 'lxc.idmap: u 0 100000 %s\n' "$GID_MAX"
  for g in "${passants[@]}"; do
    if [ "$g" -gt "$precedent" ]; then
      printf 'lxc.idmap: g %s %s %s\n' "$precedent" "$((100000 + precedent))" "$((g - precedent))"
    fi
    printf 'lxc.idmap: g %s %s 1\n' "$g" "$g"
    precedent=$((g + 1))
  done
  [ "$precedent" -lt "$GID_MAX" ] \
    && printf 'lxc.idmap: g %s %s %s\n' "$precedent" "$((100000 + precedent))" \
       "$((GID_MAX - precedent))"
  return 0
}

# ------------------------------------------------------------------- ajout

verifier_hote() {
  titre "1. La puce, vue de l'hôte"
  local noeud
  noeud=$(ls /dev/dri/renderD* 2>/dev/null | head -1)
  if [ -z "$noeud" ]; then
    mal "aucun nœud de rendu sur l'hôte : il n'y a rien à passer."
    note "Charger le pilote d'abord : « modprobe i915 » pour Intel, « amdgpu » pour AMD."
    return 1
  fi
  bon "nœud présent : $noeud"
  return 0
}

# Le conteneur non privilégié est le défaut de Proxmox ; le privilégié n'a pas besoin de mappage.
non_privilegie() {
  ! grep -qE '^\s*unprivileged:\s*0\s*$' "$CONF"
}

autoriser_subgid() {
  local g
  for g in "$@"; do
    grep -qxF "root:${g}:1" "$SUBGID" || echo "root:${g}:1" >> "$SUBGID"
  done
  bon "$SUBGID autorise root à mapper : $*"
}

# Les groupes réellement présents sur cette machine, dédoublonnés et triés.
groupes_passants() {
  local gv gr liste=()
  gv=$(gid_de video); gr=$(gid_de render)
  [ -n "$gv" ] && liste+=("$gv")
  [ -n "$gr" ] && liste+=("$gr")
  [ ${#liste[@]} -eq 0 ] && return 1
  printf '%s\n' "${liste[@]}" | sort -n -u
}

# Le bloc de configuration à ajouter, mappage compris quand le conteneur en a besoin.
lignes_a_ecrire() {
  printf 'lxc.cgroup2.devices.allow: c 226:* rwm\n'
  printf 'lxc.mount.entry: /dev/dri dev/dri none bind,optional,create=dir\n'
  non_privilegie && construire_idmap "$@"
  return 0
}

ajouter() {
  verifier_hote || return 1

  titre "2. Les groupes de cette machine"
  local passants=()
  mapfile -t passants < <(groupes_passants)
  if [ ${#passants[@]} -eq 0 ]; then
    mal "ni « video » ni « render » sur cette machine — arrêt."
    return 1
  fi
  bon "groupes passés à l'identique : ${passants[*]}"
  note "Lus sur la machine, pas supposés : ils valent 104 sur Debian et 993 sur Proxmox."

  titre "3. Ce qui sera ajouté à $CONF"
  non_privilegie && note "conteneur non privilégié : le mappage des groupes est nécessaire." \
    || note "conteneur privilégié : aucun mappage nécessaire."
  local lignes
  lignes=$(lignes_a_ecrire "${passants[@]}")
  printf '%s\n' "$lignes" | sed 's/^/      /'

  if grep -qE "$MOTIF_GERE" "$CONF"; then
    mal "ce fichier contient déjà du mappage ou un passage de /dev/dri."
    note "Relancer avec --nettoyer d'abord, sinon les deux se contrediront."
    return 1
  fi
  demander "écrire ces lignes" || { note "rien fait."; return 1; }
  sauvegarder || { mal "sauvegarde impossible — rien touché."; return 1; }
  printf '%s\n' "$lignes" >> "$CONF" || { mal "écriture impossible."; return 1; }
  bon "configuration écrite."
  non_privilegie && autoriser_subgid "${passants[@]}"

  pour_finir
  return 0
}

pour_finir() {
  titre "Pour finir"
  note "pct stop $NUMERO && pct start $NUMERO"
  note "Un redémarrage depuis l'intérieur ne suffit pas : la configuration est relue au"
  note "démarrage du conteneur, pas à celui de son système."
  note "Puis, DANS le conteneur : ./scripts/verifier-gpu.sh — l'étape 4 doit passer au vert."
  note "Si le conteneur refuse de démarrer : bash $0 $NUMERO --nettoyer"
}

case "$MODE" in
  --nettoyer) nettoyer ;;
  ajouter)    ajouter ;;
  *)          printf 'Mode inconnu : %s (attendu : --nettoyer)\n' "$MODE" >&2; exit 1 ;;
esac
