#!/bin/bash
# Le tamis posé sur l'erreur standard de ffmpeg. Il fait deux choses, et rien d'autre.
#
# 1. Il masque la clé de diffusion. ffmpeg recopie l'URL complète dans ses messages d'erreur,
#    clé comprise : elle se retrouvait en clair dans `docker logs`, que l'on colle volontiers
#    pour demander de l'aide. C'est arrivé deux fois le même jour.
#
# 2. Il nomme la destination qui tombe. Quand les deux plateformes sont actives, on n'ouvre
#    pas deux flux : on encode une fois et on distribue avec le muxer `tee`, chaque sortie
#    marquée `onfail=ignore`. Le choix est bon — une plateforme qui refuse ne doit pas
#    emporter l'autre — mais il a un prix : le refus est avalé sans bruit, et l'exploitant
#    voit « tout va bien » alors qu'il ne diffuse plus que sur une moitié. Mesuré le
#    2026-09-10 : YouTube en direct, Twitch absente, aucune erreur visible.
#
# L'ordre des destinations est passé par DESTINATIONS_ORDRE, dans l'ordre exact où
# construire_sortie() les a empilées : ffmpeg ne désigne ses sorties que par leur rang.
set -uo pipefail

FICHIER="${FICHIER_DESTINATIONS:-/tmp/lofi-destinations.json}"
read -r -a ORDRE <<< "${DESTINATIONS_ORDRE:-}"

declare -A etat=()
for plateforme in "${ORDRE[@]}"; do etat["$plateforme"]="active"; done

# Écriture atomique : le centre de contrôle lit ce fichier pendant qu'on l'écrit.
ecrire() {
  local temporaire="${FICHIER}.partiel" corps="" plateforme
  for plateforme in "${ORDRE[@]}"; do
    [ -n "$corps" ] && corps+=","
    corps+="\"${plateforme}\":\"${etat[$plateforme]}\""
  done
  printf '{%s,"ecrit":"%s"}\n' "$corps" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$temporaire" 2>/dev/null \
    && mv -f "$temporaire" "$FICHIER" 2>/dev/null
}

# Le nom lisible, pour le journal. La plateforme est déjà nommée dans DESTINATIONS_ORDRE.
libelle() {
  case "$1" in twitch) echo "Twitch" ;; youtube) echo "YouTube" ;; *) echo "$1" ;; esac
}

tomber() {
  local plateforme="$1"
  [ -n "$plateforme" ] || return 0
  [ "${etat[$plateforme]:-}" = "active" ] || return 0   # déjà signalée, on ne répète pas
  etat["$plateforme"]="refusee"
  ecrire
  local vivantes=0 p
  for p in "${ORDRE[@]}"; do [ "${etat[$p]}" = "active" ] && vivantes=$((vivantes + 1)); done
  local ou_chercher=""
  [ "$plateforme" = "twitch" ] \
    && ou_chercher=" L'onglet Twitch du centre de contrôle interroge la plateforme et dit pourquoi."
  echo "[direct] $(libelle "$plateforme") a refusé le flux — la diffusion continue sur" \
       "${vivantes} destination(s). Elle ne reviendra pas d'elle-même : le muxer abandonne" \
       "une sortie pour toute la durée du flux, il faut relancer la diffusion.${ou_chercher}"
}

# Le rang suffit à désigner la sortie ; l'URL, quand elle est là, sert de recoupement.
plateforme_du_rang() {
  local rang="$1"
  [ "$rang" -lt "${#ORDRE[@]}" ] 2>/dev/null && echo "${ORDRE[$rang]}"
}

plateforme_de_l_url() {
  case "$1" in
    *twitch*) echo "twitch" ;;
    *youtube*|*ytb*) echo "youtube" ;;
  esac
}

ecrire

sed -u -E "s#(rtmps?://[^/]+/[^/]+/)[^ :]+#\1***#g" | while IFS= read -r ligne; do
  printf '%s\n' "$ligne"
  if [[ "$ligne" =~ Slave[[:space:]]muxer[[:space:]]#([0-9]+)[[:space:]]failed ]]; then
    tomber "$(plateforme_du_rang "${BASH_REMATCH[1]}")"
  # Sans guillemet fermant dans le motif : le masquage vient d'avaler celui de fin avec la
  # clé. Exiger la paire rendait cette branche inatteignable — un garde-fou qui ne se
  # déclenche jamais n'en est pas un.
  elif [[ "$ligne" =~ Slave[[:space:]]\'([^\'[:space:]]+) ]]; then
    tomber "$(plateforme_de_l_url "${BASH_REMATCH[1]}")"
  fi
done
