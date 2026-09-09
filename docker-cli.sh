#!/bin/bash
# Détecte le client Docker utilisable et la forme de sa commande compose.
# DOCKER_CLI=<nom> impose un client précis (podman, nerdctl…).
# Renseigne DOCKER et COMPOSE, ou renvoie un code non nul si rien ne convient.

detecter_docker() {
  local candidats=(${DOCKER_CLI:-} docker)
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
    echo "[docker-cli] '$cli' répond mais aucune commande compose ne lui est associée." >&2
  done
  return 1
}

# Renvoie la commande d'installation de Docker pour la distribution courante.
# Sur Debian et Ubuntu le paquet s'appelle docker.io — `apt install docker`
# échoue et apt propose alors wmdocker, un dock Window Maker sans aucun rapport.
commande_installation() {
  local id="" like="" fichier="${OS_RELEASE:-/etc/os-release}"
  if [ -r "$fichier" ]; then
    id=$(. "$fichier" 2>/dev/null && echo "${ID:-}")
    like=$(. "$fichier" 2>/dev/null && echo "${ID_LIKE:-}")
  fi
  case "$id $like" in
    *debian*|*ubuntu*) echo "sudo apt install docker.io docker-compose-v2" ;;
    *arch*)            echo "sudo pacman -S docker docker-compose" ;;
    *fedora*|*rhel*|*centos*) echo "sudo dnf install docker docker-compose" ;;
    *alpine*)          echo "sudo apk add docker docker-cli-compose" ;;
    *suse*)            echo "sudo zypper install docker docker-compose" ;;
    *)                 echo "curl -fsSL https://get.docker.com | sh" ;;
  esac
}

expliquer_absence_docker() {
  echo "Aucun client Docker utilisable n'a été trouvé." >&2
  if command -v docker >/dev/null 2>&1; then
    echo "  Le binaire existe mais son démon ne répond pas :" >&2
    echo "    sudo systemctl enable --now docker" >&2
    echo "    sudo usermod -aG docker \$USER   (puis reconnecte-toi)" >&2
  else
    echo "  Docker n'est pas installé. Sur cette machine :" >&2
    echo "    $(commande_installation)" >&2
    echo "    sudo systemctl enable --now docker" >&2
  fi
  echo "  Un autre client (podman, nerdctl) : DOCKER_CLI=<commande> ./start.sh" >&2
}
