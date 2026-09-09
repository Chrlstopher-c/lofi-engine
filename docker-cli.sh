#!/bin/bash
# Détecte le client Docker utilisable et la forme de sa commande compose.
# Sous VM, `vmdocker` remplace `docker` — les deux sont acceptés.
# Renseigne DOCKER et COMPOSE, ou renvoie un code non nul si rien ne convient.
# DOCKER_CLI=<nom> force un client précis.

detecter_docker() {
  local candidats=(${DOCKER_CLI:-} docker vmdocker)
  local cli

  for cli in "${candidats[@]}"; do
    [ -n "$cli" ] || continue
    command -v "$cli" >/dev/null 2>&1 || continue
    "$cli" info >/dev/null 2>&1 || continue

    if "$cli" compose version >/dev/null 2>&1; then
      DOCKER="$cli"; COMPOSE="$cli compose"; return 0
    fi
    if command -v "${cli}-compose" >/dev/null 2>&1; then
      DOCKER="$cli"; COMPOSE="${cli}-compose"; return 0
    fi
    # Client trouvé mais sans compose : on le signale et on continue de chercher
    echo "[docker-cli] '$cli' répond mais aucune commande compose ne lui est associée." >&2
  done
  return 1
}

# Message d'erreur commun, pour ne pas le réécrire dans chaque script.
expliquer_absence_docker() {
  echo "Aucun client Docker utilisable n'a été trouvé." >&2
  echo "  Cherché : ${DOCKER_CLI:+$DOCKER_CLI, }docker, vmdocker (sous VM, vmdocker remplace docker)." >&2
  if command -v docker >/dev/null 2>&1 || command -v vmdocker >/dev/null 2>&1; then
    echo "  Un binaire existe mais son démon ne répond pas :" >&2
    echo "    → sudo systemctl start docker" >&2
    echo "    → ou ajoute-toi au groupe : sudo usermod -aG docker \$USER (puis reconnecte-toi)" >&2
  else
    echo "  Aucun binaire installé. Installe Docker, ou renseigne DOCKER_CLI=<commande>." >&2
  fi
}
