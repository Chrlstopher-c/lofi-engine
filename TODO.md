# TODO — LoFi Engine
*Dernière mise à jour : 2026-09-09*

## En cours
- [ ] Rien en cours.

## Chantier suivant — stream 24/7 Twitch + YouTube
**Conception écrite : `docs/STREAM-24-7.md`** — la lire avant de reprendre, elle est
auto-suffisante. Décision retenue : corpus audio pré-généré sur le PC fixe, diffusé en
boucle par un conteneur FFmpeg. Tout passe par Docker : aucun système hôte n'est modifié.

- [ ] **Bloquant** — vérifier l'origine et la licence des échantillons audio (aucune
      attribution dans le dépôt ; noms évoquant Pixabay et SoundBible, plus 48 samples de
      piano non documentés). Peut imposer des remplacements, donc à faire en premier.
- [ ] Choisir l'image de fond (décision de Chris) et vérifier sa licence.
- [ ] Construire le capteur de corpus sur le PC fixe — capture en temps réel, le rendu
      hors-ligne étant inaccessible (moteur câblé sur `Tone.Master`).
- [ ] Générer un premier corpus de quelques heures et mesurer son poids.
- [ ] Construire le conteneur diffuseur (FFmpeg), piloté par le `.env` : plateformes
      activables et clés dedans. Refus explicite si une clé manque.
- [ ] Décider sur quelle machine tourne le diffuseur (allumée en permanence, Docker requis).
- [ ] Essai sur une chaîne non listée avant toute diffusion publique.
- [ ] Activer le direct sur YouTube (24 h de délai la première fois) — à anticiper.

## À faire (priorité)
- [ ] Trancher le sort du README : conserver celui de l'amont, ou passer à la charte Echo
      (charger le skill `readme` avant d'y toucher). Décision de Chris, en attente.
- [ ] Lancer `./start.sh` une fois sur la VM Debian, une fois Docker installé
      (`apt install docker.io docker-compose-v2`), pour confirmer le parcours de bout en bout
      sur une machine autre que le PC fixe.

## Backlog
- [ ] Vérifier périodiquement l'amont (`git fetch upstream`) et intégrer ses correctifs.
- [ ] Cache navigateur explicite sur les mp3 si la fréquentation augmente
      (12,5 Mo et 45 requêtes par visiteur au premier chargement).
- [ ] Dockeriser la production sur le Pi — suppose de construire l'image sur le PC et de la
      pousser par un registre, le Pi ne pouvant pas la construire. Chantier distinct.

## Terminé
- [x] Déploiement sur le Pi : service systemd, tunnel Cloudflare, sous-domaine public — 2026-09-09
- [x] Fork sur Chrlstopher-c et mise aux normes Echo du dépôt — 2026-09-09
- [x] Scripts start/stop/restart testés dans les deux sens, `deploy-pi.sh` vérifiant la
      réponse locale et publique — 2026-09-09
- [x] Passage à Docker, validé depuis un clone vierge, joignable sur le réseau — 2026-09-09
- [x] Message d'absence de Docker donnant la commande de la distribution — 2026-09-09
- [x] Retrait de la fausse compatibilité `vmdocker` — 2026-09-09
