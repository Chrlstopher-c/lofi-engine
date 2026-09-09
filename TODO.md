# TODO — LoFi Engine
*Dernière mise à jour : 2026-09-09*

## En cours
- [ ] Rien en cours.

## Chantier en cours — stream 24/7 Twitch + YouTube
**État : construit et mesuré de bout en bout.** Mode d'emploi et preuves dans
`docs/STREAM-24-7.md`. Licences des échantillons dans `CREDITS.md`.

Fait :
- [x] Licences des échantillons tracées — piano (Salamander/Alexander Holm) et vent
      (Mark DiAngelo) en CC BY 3.0, crédit à porter en description ; jungle en domaine
      public ; orage en royalty-free. Aucun remplacement nécessaire.
- [x] `?autoplay=1` sur la page, pour démarrer le moteur sans clic.
- [x] Conteneur de capture du corpus (navigateur + écran virtuel + serveur audio + ffmpeg),
      avec refus de capturer si le niveau mesuré est du silence, et élagage des segments
      inexploitables.
- [x] Conteneur de diffusion depuis le corpus, piloté par le `.env` : plateformes activables,
      clés dedans, refus explicite nommant ce qui manque.
- [x] Conteneur de diffusion en direct avec repli sur le corpus.
- [x] Chaîne validée sur un serveur RTMP local : H.264 720p30 + AAC 44,1 kHz stéréo,
      images-clés à 2,00 s (limite Twitch), son présent à -24 dBFS.

Reste :
- [ ] **Décision de Chris** — sur quelle machine tourne le direct (Docker, allumée en
      permanence). Le corpus pèse ~400 Mo par heure.
- [ ] **Décision de Chris** — l'image de fond, et vérifier sa licence.
      `corpus/fond-test.png` n'est qu'une mire de validation.
- [ ] Générer un vrai corpus de secours de quelques heures (temps réel : 1 h = 1 h).
- [ ] Activer le direct sur YouTube (24 h de délai la première fois) — à anticiper.
- [ ] Essai sur une chaîne non listée avant toute diffusion publique.
- [ ] Porter les crédits (`CREDITS.md`) dans la description de la chaîne.

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
