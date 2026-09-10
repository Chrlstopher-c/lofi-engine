# Composition de la scène par ffmpeg, sans passer par un navigateur.
# Sourcé par direct.sh, jamais exécuté.
#
# Le navigateur affichait la scène et ffmpeg recapturait son écran : deux rendus complets
# de la même image, 167 % de processeur mesurés. ffmpeg sait composer lui-même — fond,
# voile, incrustations, texte — pour 83 %. Le navigateur reste, réduit à la musique.

COMPOSITEUR="${COMPOSITEUR:-/usr/local/bin/composer.py}"
FICHIER_DATE="${FICHIER_DATE:-/tmp/lofi-date.txt}"
FICHIER_ACCORDS="${FICHIER_ACCORDS:-/tmp/lofi-accords.txt}"
CADENCE_ACCORDS=0.5       # les accords changent à la mesure : la boucle doit suivre
RELAIS_ACCORDS="${RELAIS_ACCORDS:-/usr/local/bin/relais-accords.py}"
RELAIS_ACCORDS_PID=""
FICHIER_SCENE="${FICHIER_SCENE:-${CORPUS_DIR:-/corpus}/scene.json}"
ECRAN_MOTEUR="${ECRAN_MOTEUR:-360x240x24}"   # le navigateur ne sert plus qu'à jouer, pas à montrer
ARGS_COMPOSITION=()
EMPREINTE_SCENE=""
EMPREINTE_ATTENTE=""      # empreinte vue au tour précédent, pas encore appliquée
APAISEMENT=3              # pulsations pendant lesquelles la scène doit rester stable
COMPTE_APAISEMENT=0

JOURS_FR=(dimanche lundi mardi mercredi jeudi vendredi samedi)
MOIS_FR=(janvier février mars avril mai juin juillet août septembre octobre novembre décembre)

# ffmpeg écrit les dates dans la locale du système, que l'image n'a pas. On la lui donne
# dans un fichier qu'il relit à chaque image — le même mécanisme servira aux accords.
ecrire_date() {
  local jour mois
  jour="${JOURS_FR[$(date +%w)]}"
  mois="${MOIS_FR[$(( 10#$(date +%m) - 1 ))]}"
  printf '%s %s %s' "${jour^}" "$(date +%-d)" "$mois" > "$FICHIER_DATE" 2>/dev/null
}

# Les accords naissent dans le navigateur : lui seul les connaît. La page les dépose sur le
# serveur du site, cette boucle les recopie dans un fichier que drawtext relit à chaque image.
# Sans elle, le calque des accords forcerait le retour au navigateur pour toute la scène.
demarrer_relais_accords() {
  [ -n "$RELAIS_ACCORDS_PID" ] && return 0
  : > "$FICHIER_ACCORDS"
  FICHIER_ACCORDS="$FICHIER_ACCORDS" LOFI_BASE="$LOFI_BASE" CADENCE_ACCORDS="$CADENCE_ACCORDS" \
    setsid python3 "$RELAIS_ACCORDS" >/tmp/relais-accords.log 2>&1 &
  RELAIS_ACCORDS_PID=$!
  journal "relais d'accords en marche (PID $RELAIS_ACCORDS_PID)"
}

# Arrêt par groupe, sur le PID exact retenu au démarrage : jamais par motif de nom.
arreter_relais_accords() {
  [ -n "$RELAIS_ACCORDS_PID" ] || return 0
  kill -TERM -- "-$RELAIS_ACCORDS_PID" 2>/dev/null
  RELAIS_ACCORDS_PID=""
}

empreinte_scene() {
  stat -c '%Y %s' "$FICHIER_SCENE" 2>/dev/null || echo "absente"
}

# Remplit ARGS_COMPOSITION. Rend 0 si toute la scène y est, 2 s'il a fallu en laisser
# (un calque que seul le moteur sait produire), 1 si la scène n'est pas composable du tout.
preparer_composition() {
  ecrire_date
  demarrer_relais_accords
  local sortie code
  sortie=$(STREAM_RESOLUTION="$STREAM_RESOLUTION" STREAM_FPS="$STREAM_FPS" \
           CORPUS_DIR="${CORPUS_DIR:-/corpus}" FICHIER_DATE="$FICHIER_DATE" \
           FICHIER_ACCORDS="$FICHIER_ACCORDS" \
           ENTREES_AVANT=1 FILTRE_SORTIE="${FILTRE_SORTIE:-}" \
           python3 "$COMPOSITEUR" "$FICHIER_SCENE" 2>/tmp/composition.log)
  code=$?
  [ "$code" -eq 1 ] && { journal "composition impossible : $(tail -1 /tmp/composition.log)"; return 1; }
  mapfile -t ARGS_COMPOSITION <<< "$sortie"
  EMPREINTE_SCENE=$(empreinte_scene)
  return "$code"
}

# ffmpeg compose, ou le navigateur affiche et ffmpeg recapture. « auto » préfère composer,
# sauf si la scène contient quelque chose que seul le navigateur sait rendre : mieux vaut
# une scène complète et chère qu'une scène légère et amputée.
choisir_mode_scene() {
  if [ "$STREAM_COMPOSITEUR" = "navigateur" ]; then
    MODE_SCENE="navigateur"
    journal "scène : affichée par le navigateur (STREAM_COMPOSITEUR=navigateur)"
    return 0
  fi

  preparer_composition
  local code=$?
  if [ "$code" -eq 1 ]; then
    MODE_SCENE="navigateur"
    journal "scène : affichée par le navigateur — la composition a échoué (voir /tmp/composition.log)"
    return 0
  fi
  if [ "$code" -eq 2 ] && [ "$STREAM_COMPOSITEUR" != "ffmpeg" ]; then
    MODE_SCENE="navigateur"
    journal "scène : affichée par le navigateur — une partie ne se compose pas :
       $(tail -1 /tmp/composition.log)
       Pour composer quand même, en acceptant la perte : STREAM_COMPOSITEUR=ffmpeg."
    return 0
  fi
  MODE_SCENE="ffmpeg"
  [ "$code" -eq 2 ] && journal "ATTENTION : $(tail -1 /tmp/composition.log)"
  journal "scène : composée par ffmpeg — le navigateur ne sert plus qu'à la musique"
  return 0
}

# Recomposer coupe le flux le temps que ffmpeg reparte, et une plateforme met parfois
# plusieurs minutes à re-signaler le direct. Éditer une scène produit plusieurs
# enregistrements d'affilée : on attend qu'elle se taise avant de payer ce prix une fois.
scene_modifiee() {
  [ "$MODE_SCENE" = "ffmpeg" ] || return 1
  local vue
  vue=$(empreinte_scene)
  if [ "$vue" = "$EMPREINTE_SCENE" ]; then
    EMPREINTE_ATTENTE=""
    COMPTE_APAISEMENT=0
    return 1
  fi
  if [ "$vue" != "$EMPREINTE_ATTENTE" ]; then
    EMPREINTE_ATTENTE="$vue"      # elle bouge encore : on redémarre le compte à rebours
    COMPTE_APAISEMENT=0
    return 1
  fi
  COMPTE_APAISEMENT=$((COMPTE_APAISEMENT + 1))
  [ "$COMPTE_APAISEMENT" -ge "$APAISEMENT" ]
}
