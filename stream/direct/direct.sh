#!/bin/bash
# Diffusion en direct : le moteur génère la musique en continu dans un navigateur,
# ffmpeg pousse cette sortie vers Twitch et/ou YouTube sans jamais s'interrompre.
#
# Le repli joue le corpus enregistré DANS le même puits audio : si le navigateur meurt,
# ffmpeg continue de lire le puits et le flux ne se coupe pas. C'est tout l'intérêt.
set -uo pipefail

ETIQUETTE="direct"
# shellcheck source=/dev/null
. /usr/local/lib/lofi/commun.sh
# shellcheck source=/dev/null
. /usr/local/lib/lofi/navigateur.sh
# shellcheck source=/dev/null
. /usr/local/bin/composition.sh

STREAM_SCENE="${STREAM_SCENE:-true}"   # false = image fixe au lieu de la scène animée
ECRAN=""                 # écran capturé, calé sur la résolution une fois celle-ci arrêtée
LOFI_BASE="${LOFI_BASE:-http://lofi-engine:4707}"
LOFI_URL="${LOFI_URL:-}"
PULSATION=2              # secondes entre deux vérifications que le navigateur est vivant
PULSATIONS_PAR_CONTROLE=10   # une mesure de niveau toutes les 10 pulsations (20 s)
MESURE=4                 # durée d'une mesure de niveau
SILENCES_TOLERES=2       # contrôles muets consécutifs avant de basculer sur le repli
CYCLES_AVANT_RETEST=15   # contrôles sous repli avant de retenter le navigateur (~5 min)
STREAM_ENCODEUR="${STREAM_ENCODEUR:-auto}"   # auto | nvenc | vaapi | x264
STREAM_COMPOSITEUR="${STREAM_COMPOSITEUR:-auto}"  # auto | ffmpeg | navigateur
MODE_SCENE="navigateur"  # qui dessine la scène : ffmpeg, ou le navigateur qu on recapture
NOEUD_RENDU="${NOEUD_RENDU:-/dev/dri/renderD128}"
STREAM_ADAPTER="${STREAM_ADAPTER:-true}"     # abaisser la définition si la machine ne suit pas
COEURS_POUR_1080P_LOGICIEL=6                 # mesuré : 1080p sans puce vidéo coûte ~3 cœurs pleins
ENCODEUR_RETENU=""
DEBIT_VIDEO=()        # vide en qualité constante, rempli par regler_debit
REPOS_INGESTION=2      # secondes laissées à la plateforme avant de renvoyer un flux
REPLI_PID=""
DIFFUSION_PID=""
ENTREE_VIDEO=()
PREFIXE_ENCODEUR=()   # options globales, avant les entrées
ENCODEUR_VIDEO=()     # codec et mise à l'échelle, remplis par choisir_encodeur
FILTRE_SORTIE=""      # greffé en bout de composition quand l'encodeur l'exige

# Encoder en logiciel coûte un cœur entier en 1080p ; la puce vidéo d'un GPU le fait pour rien.
# Chaque profil est essayé pour de vrai avant d'être retenu : une carte visible ne garantit pas
# que la bibliothèque d'encodage soit là, et découvrir l'échec en direct coûterait le flux.
# Quand ffmpeg compose lui-même, l'image sort déjà à la bonne taille et le transfert vers
# une carte VAAPI appartient à la chaîne de composition : plus de -s ni de -vf ici.
# Le rapport de pixel est remis à 1 partout où l'on met à l'échelle. Il TRAVERSE scale, -s et
# crop : une source à pixels non carrés ressort à la bonne taille en déclarant la mauvaise
# forme, et la plateforme encadre l'image de noir pour l'y faire tenir. Mesuré le 2026-09-10 :
# une source 1440x1080 en SAR 4:3 donnait un 1920x1080 annoncé en 64:27.
profil_encodeur() {
  local largeur="${STREAM_RESOLUTION%x*}" hauteur="${STREAM_RESOLUTION#*x}"
  local compose="${2:-navigateur}"
  local echelle=(-vf "scale=${largeur}:${hauteur},setsar=1")
  [ "$compose" = "ffmpeg" ] && echelle=()
  PREFIXE_ENCODEUR=()
  FILTRE_SORTIE=""
  case "$1" in
    nvenc)
      ENCODEUR_VIDEO=(-c:v h264_nvenc -preset p4 -tune ll -rc cbr -pix_fmt yuv420p
                      "${echelle[@]}" -r "$STREAM_FPS") ;;
    vaapi|vaapi-lp|vaapi-cqp)
      # Trois variantes de la même puce, essayées dans cet ordre par choisir_encodeur.
      # Les petites puces Intel n'exposent l'encodage que par l'entrée « basse consommation »
      # (VAEntrypointEncSliceLP), qui n'accepte pas toujours le débit constant. Mesuré le
      # 2026-09-10 sur un NUC : « Driver does not support any RC mode compatible with selected
      # options (supported modes: CQP) », et l'encodage retombait en logiciel alors que la puce
      # savait très bien encoder.
      local qualite=()
      case "$1" in
        vaapi)      qualite=(-rc_mode CBR) ;;
        vaapi-lp)   qualite=(-low_power 1 -rc_mode CBR) ;;
        # Sans débit constant, le poids du flux suit la complexité de l'image. Sur une scène
        # lofi presque fixe, il reste bien en dessous du plafond des plateformes.
        vaapi-cqp)  qualite=(-low_power 1 -rc_mode CQP -qp 24) ;;
      esac
      PREFIXE_ENCODEUR=(-vaapi_device "$NOEUD_RENDU")
      if [ "$compose" = "ffmpeg" ]; then
        FILTRE_SORTIE="format=nv12,hwupload"
        ENCODEUR_VIDEO=(-c:v h264_vaapi "${qualite[@]}" -r "$STREAM_FPS")
      else
        # La mise à l'échelle se fait avant le transfert vers la carte : une seule copie.
        ENCODEUR_VIDEO=(-vf "scale=${largeur}:${hauteur},setsar=1,format=nv12,hwupload"
                        -c:v h264_vaapi "${qualite[@]}" -r "$STREAM_FPS")
      fi ;;
    x264)
      ENCODEUR_VIDEO=(-c:v libx264 -preset veryfast -tune stillimage -pix_fmt yuv420p
                      "${echelle[@]}" -r "$STREAM_FPS" -sc_threshold 0) ;;
    *) return 1 ;;
  esac
  return 0
}

# Encode une image noire avec le profil demandé. Silencieux : seul le code de sortie compte.
# En qualité constante, un débit imposé n'a pas de sens — et le passer quand même fait refuser
# l'encodeur, ce qui remettrait exactement le défaut qu'on vient de corriger.
regler_debit() {
  if [ "${1:-}" = "vaapi-cqp" ]; then
    DEBIT_VIDEO=()
  else
    DEBIT_VIDEO=(-b:v "$STREAM_VIDEO_BITRATE" -maxrate "$STREAM_VIDEO_BITRATE"
                 -bufsize "$STREAM_VIDEO_BITRATE")
  fi
}

essayer_encodeur() {
  profil_encodeur "$1" || return 1
  regler_debit "$1"
  ffmpeg -hide_banner -loglevel error -nostdin "${PREFIXE_ENCODEUR[@]}" \
    -f lavfi -i "color=c=black:s=${STREAM_RESOLUTION}:r=${STREAM_FPS}" -frames:v 1 \
    "${ENCODEUR_VIDEO[@]}" "${DEBIT_VIDEO[@]}" -f null - >/dev/null 2>&1
}

choisir_encodeur() {
  local candidats=(nvenc vaapi vaapi-lp vaapi-cqp x264) choix
  if [ "$STREAM_ENCODEUR" != "auto" ]; then
    if essayer_encodeur "$STREAM_ENCODEUR"; then
      ENCODEUR_RETENU="$STREAM_ENCODEUR"
      journal "encodeur : $STREAM_ENCODEUR (imposé par STREAM_ENCODEUR)"
      return 0
    fi
    journal "ATTENTION : encodeur $STREAM_ENCODEUR demandé mais inutilisable ici — retour au choix automatique"
  fi
  for choix in "${candidats[@]}"; do
    if essayer_encodeur "$choix"; then
      ENCODEUR_RETENU="$choix"
      case "$choix" in
        nvenc) journal "encodeur : NVENC (puce vidéo NVIDIA) — le processeur n'encode plus" ;;
        vaapi) journal "encodeur : VAAPI via $NOEUD_RENDU — le processeur n'encode plus" ;;
        vaapi-lp) journal "encodeur : VAAPI basse consommation via $NOEUD_RENDU — le processeur
       n'encode plus. La puce n'expose l'encodage que par cette voie." ;;
        vaapi-cqp) journal "encodeur : VAAPI basse consommation à qualité constante via
       $NOEUD_RENDU. Cette puce n'accepte pas le débit constant : le poids du flux suivra la
       complexité de l'image, ce qui reste sans danger sur une scène lofi." ;;
        x264)  journal "encodeur : libx264 (logiciel). Aucune puce vidéo accessible : compter
       environ un cœur en 1080p. Donner /dev/dri ou un GPU au conteneur divise cette charge." ;;
      esac
      return 0
    fi
    journal "encodeur $choix indisponible, essai suivant"
  done
  echec "aucun encodeur vidéo utilisable, pas même libx264"
}

# Sans puce vidéo, le 1080p demande environ trois cœurs pour l'encodage, plus autant pour le
# navigateur qui décode le fond : sur une petite machine le flux ne décroche pas franchement,
# il s'étrangle — les tampons gonflent jusqu'à ce que quelque chose meure. Mieux vaut diffuser
# en 1280x720 que crasher au bout d'une minute. Se désactive avec STREAM_ADAPTER=false.
adapter_charge() {
  if [ "$MODE_SCENE" = "ffmpeg" ]; then
    # Personne ne regarde cet écran : il n'existe que parce que le navigateur refuse de
    # démarrer sans affichage. Le garder en 1080p coûterait un rendu complet pour rien.
    ECRAN="$ECRAN_MOTEUR"
  else
    ECRAN="${ECRAN_DIRECT:-${STREAM_RESOLUTION}x24}"
  fi
  # Composer coûte trois fois moins cher que recapturer un navigateur, mais l'encodage, lui,
  # coûte pareil : sans puce vidéo, 1080p reste hors de portée d'une petite machine dans les
  # deux modes. Ce garde-fou ne regardait que le mode navigateur — une VM à quatre cœurs
  # partait donc en 1080p logiciel et s'étranglait au bout d'une minute.
  vrai "$STREAM_ADAPTER" || return 0
  [ "$ENCODEUR_RETENU" = "x264" ] || return 0
  [ "${STREAM_RESOLUTION%x*}" -gt 1280 ] || return 0

  local coeurs
  coeurs=$(nproc 2>/dev/null || echo 0)
  [ "$coeurs" -lt "$COEURS_POUR_1080P_LOGICIEL" ] || return 0

  journal "définition abaissée à 1280x720 : ${coeurs} cœur(s) et aucune puce vidéo accessible,
       ${STREAM_RESOLUTION} en logiciel en demande environ ${COEURS_POUR_1080P_LOGICIEL}.
       Pour diffuser malgré tout en ${STREAM_RESOLUTION}, mettre STREAM_ADAPTER=false dans le .env.
       Pour retrouver la pleine définition, donner une puce vidéo au conteneur : sur Proxmox, un
       conteneur LXC voit /dev/dri de l'hôte, une machine virtuelle non."
  STREAM_RESOLUTION="1280x720"
  [ "$MODE_SCENE" = "ffmpeg" ] || ECRAN="${ECRAN_DIRECT:-1280x720x24}"
  profil_encodeur "$ENCODEUR_RETENU" "$MODE_SCENE"
regler_debit "$ENCODEUR_RETENU"
  # La composition a été bâtie à l'ancienne définition : la refaire, sinon ffmpeg dessinerait
  # toujours une image 1080p pour l'encoder en 720p.
  [ "$MODE_SCENE" = "ffmpeg" ] && preparer_composition
  return 0
}

# Source vidéo : la scène composée par ffmpeg, l'écran virtuel du navigateur, ou une image fixe.
choisir_entree_video() {
  if [ "$MODE_SCENE" = "ffmpeg" ]; then
    ENTREE_VIDEO=()          # tout vient de ARGS_COMPOSITION, qui porte ses propres entrées
    journal "vidéo : scène composée en ${STREAM_RESOLUTION} @ ${STREAM_FPS} i/s"
  elif vrai "$STREAM_SCENE"; then
    ENTREE_VIDEO=(-thread_queue_size 512 -f x11grab -draw_mouse 0 -framerate "$STREAM_FPS"
                  -video_size "${ECRAN%x*}" -i "$DISPLAY")
    journal "vidéo : capture de la scène (${ECRAN%x*})"
  else
    ENTREE_VIDEO=(-thread_queue_size 512 -re -loop 1 -framerate "$STREAM_FPS" -i "$STREAM_IMAGE")
    journal "vidéo : image fixe ($STREAM_IMAGE)"
  fi
}

# En composition, le puits audio est ouvert en premier : la scène référence ses propres
# entrées par des index, et elle a été construite en sachant qu'une entrée la précède.
lancer_diffusion() {
  local gop=$((STREAM_FPS * 2))
  local entrees=() maps=()
  if [ "$MODE_SCENE" = "ffmpeg" ]; then
    entrees=(-thread_queue_size 1024 -f pulse -i "${SINK}.monitor" "${ARGS_COMPOSITION[@]}")
    maps=(-map 0:a)
  else
    entrees=("${ENTREE_VIDEO[@]}" -thread_queue_size 1024 -f pulse -i "${SINK}.monitor")
    maps=(-map 0:v -map 1:a)
  fi
  # -aspect déclare la forme de l'image sur le flux lui-même, dans les métadonnées que la
  # plateforme lit. C'est une ceinture par-dessus les bretelles de setsar : la forme ne dépend
  # alors plus d'aucune source, ni d'aucun filtre en amont. Vérifié : elle survit à la mise en
  # conteneur FLV, celui réellement poussé en RTMP.
  # setsid donne au flux son propre groupe de processus : recharger la scène doit pouvoir
  # arrêter ffmpeg et sa boucle de reconnexion ensemble, sans chercher de PID au jugé.
  # L'erreur standard de ffmpeg passe par le tamis : il masque la clé de diffusion, que
  # ffmpeg recopie en clair dans ses messages, et nomme la destination qui tombe — sans lui
  # le muxer tee abandonne une plateforme en silence. Il est branché sur l'erreur seule,
  # pour ne pas masquer le code de sortie de ffmpeg derrière le sien.
  setsid bash -c '
    while true; do
      ffmpeg -hide_banner -loglevel warning -nostdin "$@" \
        2> >(/usr/local/bin/tamis.sh >&2)
      echo "[direct] le flux s'"'"'est interrompu — reconnexion dans 10 s"
      sleep 10
    done' _ \
    "${PREFIXE_ENCODEUR[@]}" "${entrees[@]}" "${maps[@]}" \
    "${ENCODEUR_VIDEO[@]}" \
    -aspect "${STREAM_RESOLUTION%x*}:${STREAM_RESOLUTION#*x}" \
    "${DEBIT_VIDEO[@]}" \
    -g "$gop" -keyint_min "$gop" \
    -c:a aac -b:a "$STREAM_AUDIO_BITRATE" -ar 44100 -ac 2 \
    "${FORMAT_SORTIE[@]}" &
  DIFFUSION_PID=$!
  journal "diffusion lancée (groupe $DIFFUSION_PID)"
}

# Attendre que le groupe soit VRAIMENT vide avant de rendre la main. La boucle qui relance
# ffmpeg rend la main dès qu'elle reçoit TERM, mais ffmpeg, lui, met encore un instant à fermer
# sa connexion RTMP — le journal le montre : « Failed to update header » arrive APRÈS l'annonce
# de la diffusion suivante. Repartir à ce moment-là met deux émetteurs sur la même clé, et
# Twitch les refuse tous les deux : le flux part alors en boucle d'erreurs d'entrée/sortie.
arreter_diffusion() {
  [ -n "$DIFFUSION_PID" ] || return 0
  local groupe="$DIFFUSION_PID" i
  kill -TERM -- "-$groupe" 2>/dev/null || kill "$groupe" 2>/dev/null
  wait "$groupe" 2>/dev/null
  for ((i = 0; i < 50; i++)); do
    pgrep -g "$groupe" >/dev/null 2>&1 || break
    sleep 0.2
  done
  if pgrep -g "$groupe" >/dev/null 2>&1; then
    journal "le groupe $groupe ne se termine pas — arrêt forcé"
    kill -KILL -- "-$groupe" 2>/dev/null
    sleep 1
  fi
  DIFFUSION_PID=""
}

# La scène a changé sous nos pieds : on la recompose et on repart. Quelques secondes de
# coupure, que les plateformes absorbent — c'est le prix d'un changement de composition.
recharger_scene() {
  journal "scène modifiée — recomposition"
  if ! preparer_composition; then
    journal "la nouvelle scène ne se compose pas, l'ancienne continue"
    return 1
  fi
  arreter_diffusion
  # Twitch garde la session ouverte un court moment après une déconnexion : se reconnecter
  # dans la seconde se fait refuser. Deux secondes suffisent.
  sleep "$REPOS_INGESTION"
  lancer_diffusion
  return 0
}

demarrer_repli() {
  [ -z "$REPLI_PID" ] || return 0
  if [ "$(compter_corpus)" -eq 0 ]; then
    journal "ATTENTION : pas de corpus de secours, le flux restera muet jusqu'au retour du moteur"
    return 1
  fi
  construire_playlist /tmp/repli.txt 20 >/dev/null
  ffmpeg -hide_banner -loglevel error -nostdin \
    -re -f concat -safe 0 -stream_loop -1 -i /tmp/repli.txt \
    -f pulse -device "$SINK" "repli-lofi" >/tmp/repli.log 2>&1 &
  REPLI_PID=$!
  journal "repli activé — lecture du corpus enregistré"
}

arreter_repli() {
  [ -n "$REPLI_PID" ] || return 0
  kill "$REPLI_PID" 2>/dev/null
  wait "$REPLI_PID" 2>/dev/null
  REPLI_PID=""
  journal "repli arrêté"
}

relancer_navigateur() {
  journal "relance du navigateur"
  arreter_navigateur
  demarrer_navigateur "$(construire_url)" kiosque || return 1
  attendre "reprise du moteur" 90 'il_y_a_du_son 3'
}

nettoyer() {
  arreter_repli
  arreter_navigateur
  arreter_diffusion
  arreter_relais_accords
  pulseaudio --kill 2>/dev/null
  return 0
}
trap 'journal "arrêt demandé"; nettoyer; exit 0' TERM INT
trap nettoyer EXIT

# Bascule sur le corpus, tente de relever le navigateur, et coupe le repli s'il repart.
basculer_et_relever() {
  demarrer_repli
  if relancer_navigateur; then
    arreter_repli
    journal "moteur reparti — retour à la génération en direct"
    return 0
  fi
  journal "le moteur n'est pas reparti — le corpus prend le relais"
  return 1
}

# Le repli tourne : on le coupe brièvement pour voir si le moteur a repris de lui-même.
retester_moteur() {
  arreter_repli
  if il_y_a_du_son "$MESURE"; then
    journal "moteur revenu de lui-même — retour à la génération en direct"
    return 0
  fi
  basculer_et_relever
  return 1
}

# Boucle de supervision, à deux vitesses : la mort du navigateur est le cas le plus probable
# et doit être vue en quelques secondes, sinon le flux part en silence le temps qu'on s'en
# aperçoive. La mesure de niveau, elle, coûte plusieurs secondes d'écoute : elle est plus rare.
# C'est le processus principal du conteneur ; il ne se termine que sur signal (voir le trap).
surveiller() {
  local silences=0 cycles_repli=0 tic=0
  while true; do
    sleep "$PULSATION"

    if ! kill -0 "$NAVIGATEUR_PID" 2>/dev/null; then
      journal "le navigateur ne tourne plus"
      basculer_et_relever && silences=0
      cycles_repli=0; tic=0
      continue
    fi

    if scene_modifiee; then
      recharger_scene
      tic=0
      continue
    fi

    tic=$((tic + 1))
    [ "$tic" -ge "$PULSATIONS_PAR_CONTROLE" ] || continue
    tic=0

    if [ -n "$REPLI_PID" ]; then
      cycles_repli=$((cycles_repli + 1))
      if [ "$cycles_repli" -ge "$CYCLES_AVANT_RETEST" ]; then
        cycles_repli=0
        retester_moteur && silences=0
      fi
      continue
    fi

    # La date est lue dans un fichier à chaque image : la réécrire ici suffit à la voir
    # changer à minuit, sans minuterie supplémentaire.
    [ "$MODE_SCENE" = "ffmpeg" ] && ecrire_date

    if il_y_a_du_son "$MESURE"; then
      silences=0
    else
      silences=$((silences + 1))
      journal "silence détecté ($silences/$SILENCES_TOLERES)"
      if [ "$silences" -ge "$SILENCES_TOLERES" ]; then
        basculer_et_relever && silences=0
      fi
    fi
  done
}

# La scène est servie par le conteneur du site : même origine que le moteur, donc l'iframe
# qui produit le son n'est pas bridée par la politique inter-origines.
construire_url() {
  if [ -n "$LOFI_URL" ]; then echo "$LOFI_URL"; return 0; fi
  if ! vrai "$STREAM_SCENE"; then echo "${LOFI_BASE}/?autoplay=1"; return 0; fi
  # Quand ffmpeg compose, la page n'a plus qu'à jouer : elle ne dessine rien.
  if [ "$MODE_SCENE" = "ffmpeg" ]; then echo "${LOFI_BASE}/scene/scene.html?audio=1"; return 0; fi
  # Aucun paramètre : la scène se définit dans scene.json, écrit par le centre de contrôle.
  # Passer des valeurs ici recréerait une seconde source de vérité qui l'écraserait.
  echo "${LOFI_BASE}/scene/scene.html"
}

# Le centre de contrôle tourne sur l'hôte et ne lit pas ce journal : sans ce fichier, l'interface
# ne peut pas dire si la puce vidéo encode ou si le processeur a repris la main. Écrit dans le
# /tmp du conteneur, que ce processus possède toujours — le corpus, lui, est un répertoire de
# l'hôte dont rien ne garantit qu'il soit accessible en écriture à l'utilisateur du conteneur.
# Ces valeurs sont arrêtées au démarrage et ne changent plus tant que ce processus vit.
ecrire_rendu() {
  local fichier="${FICHIER_RENDU:-/tmp/lofi-rendu.json}" temporaire
  temporaire="${fichier}.partiel"
  printf '{"encodeur":"%s","modeScene":"%s","resolution":"%s","fps":"%s","coeurs":%s,"ecrit":"%s"}\n' \
    "$ENCODEUR_RETENU" "$MODE_SCENE" "$STREAM_RESOLUTION" "$STREAM_FPS" \
    "$(nproc 2>/dev/null || echo 0)" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$temporaire" 2>/dev/null \
    && mv -f "$temporaire" "$fichier" 2>/dev/null \
    || journal "ATTENTION : $fichier non écrit — l'interface ne saura pas quel encodeur tourne"
}

valider_plateformes
vrai "$STREAM_SCENE" || verifier_image_fixe
construire_sortie
# L'encodeur et la définition se décident avant tout le reste : l'écran virtuel, le navigateur
# et l'annonce des destinations en dépendent tous les trois.
choisir_encodeur
vrai "$STREAM_SCENE" && choisir_mode_scene
# Le relais démarre avec la première tentative de composition ; s'il faut finalement passer par
# le navigateur, il n'a plus d'objet — c'est le navigateur qui dessine les accords.
[ "$MODE_SCENE" = "navigateur" ] && arreter_relais_accords
adapter_charge
# Le profil d'encodeur dépend du mode : en composition, l'échelle et le transfert vers la
# carte appartiennent à la chaîne de filtres, pas aux options de sortie.
profil_encodeur "$ENCODEUR_RETENU" "$MODE_SCENE"
[ "$MODE_SCENE" = "ffmpeg" ] && [ -n "$FILTRE_SORTIE" ] && preparer_composition
annoncer_destinations
ecrire_rendu
journal "corpus de secours : $(compter_corpus) fichier(s)"

demarrer_environnement
demarrer_navigateur "$(construire_url)" kiosque
attendre "chargement des échantillons" 90 'pactl list sink-inputs 2>/dev/null | grep -q .' \
  || echec "le navigateur n'a jamais produit de flux audio (voir /tmp/chromium.log)"
il_y_a_du_son 10 || echec "silence au démarrage — vérifier que l'URL contient ?autoplay=1"
journal "moteur en marche — début de la diffusion en direct"

choisir_entree_video
lancer_diffusion
surveiller
