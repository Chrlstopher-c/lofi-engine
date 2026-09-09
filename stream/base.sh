# Journalisation et lecture de booléens, partagées par tous les scripts du stream.
ETIQUETTE="${ETIQUETTE:-lofi}"
journal() { printf '[%s] %s\n' "$ETIQUETTE" "$*" >&2; }
echec()   { printf '[%s] ÉCHEC — %s\n' "$ETIQUETTE" "$*" >&2; exit 1; }
vrai()    { case "${1,,}" in true|1|oui|yes|on) return 0 ;; *) return 1 ;; esac; }
