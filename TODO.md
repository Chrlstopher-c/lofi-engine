# TODO — LoFi Engine
*Dernière mise à jour : 2026-09-09*

## En cours
- [x] **Socle du nouveau dessin** — jetons, thèmes clair et sombre, échelles, briques communes.
- [x] **Porter les panneaux sur ce socle** — `ui/scene/`, `ui/diffusion/`, `ui/twitch/`.
      Vérifié dans un navigateur, diffusion en cours, zéro erreur en console.
- [x] **Élaguer `ui/styles/heritage.css`** — 238 → 111 lignes, il ne reste que ce qui sert.

## Ce que le dessin attend du serveur
La maquette prévoit des choses que le backend ne sait pas encore dire. Les panneaux les
laissent de côté plutôt que d'afficher du vide décoratif — chacune est une petite tâche
serveur, pas un chantier d'interface.

- [ ] **Encodeur retenu et charge du processeur** exposés par l'API — le panneau Diffusion a
      la place et le dessin, il lui manque la donnée. C'est aussi ce qui manque le plus : on
      ne voit pas depuis l'interface si la puce vidéo encode ou si le processeur a repris la
      main.
- [ ] **État par destination** — « reçoit », « clé refusée ». Aujourd'hui seule l'existence
      d'une clé est affichée.
- [ ] **Profil appliqué à l'antenne** — le serveur ne dit pas quelle composition est en cours,
      donc aucune carte ne peut porter le badge.
- [ ] **Dupliquer et renommer une composition** — aucune route ; dupliquer imposerait de
      charger le profil, ce qui remplacerait la scène diffusée.
- [ ] **Modération du chat** (bannir, expulser, mode lent) — aucune route Twitch câblée.
- [ ] **Historique d'édition de la scène** (annuler / rétablir) — il n'y a pas de pile d'états
      dans l'éditeur ; le popover de la maquette serait décoratif sans elle.
- [ ] **Dimensions d'un calque en pixels** — le modèle n'a qu'une taille uniforme, d'où des
      poignées d'angle seulement. À trancher : est-ce qu'on veut vraiment déformer un calque ?
- [ ] **`ui/profils/PanneauProfils.tsx` n'est plus importé par personne** — les compositions
      l'ont remplacé. À supprimer une fois qu'on est sûr de ne pas y revenir.

## À faire
- [ ] **Afficher les accords quand ffmpeg compose** — c'est le seul calque qui force encore
      la scène à repasser par le navigateur, bien plus coûteux. Le mécanisme existe déjà : la
      date est écrite dans un fichier que ffmpeg relit à chaque image. Il suffit que le moteur
      musical écrive l'accord courant dans un fichier du même genre.
- [ ] **Exercer VAAPI sur du vrai matériel Intel** — le profil n'a jamais encodé une image sur
      une puce Intel, faute d'en avoir une ici. À faire chez quelqu'un qui en a une.
- [ ] **Passer la diffusion à 30 images par seconde** — le `.env` est encore à 25, hérité de
      l'époque où le processeur encodait. La carte tient les 30 sans effort. Décision de Chris.
- [ ] **Migrer l'installation de l'ami en conteneur LXC** — une VM Proxmox ne voit pas la puce
      vidéo du NUC, donc son encodage restera logiciel tant qu'il tourne en VM.

## Stream 24/7 — en service
**Diffuse réellement sur Twitch.** Mode d'emploi et mesures : `docs/STREAM-24-7.md`.
Licences des échantillons : `CREDITS.md`. Fonds animés : `docs/FONDS-ANIMES.md`.

Fait : scène en calques pilotée à chaud · centre de contrôle (scène, diffusion, Twitch) ·
aperçu en temps réel et mode composition · profils · vidéos et GIF en boucle · repli sur
corpus en 3,5 s · intégration Twitch complète (compte, clé récupérée automatiquement, titre,
catégorie, spectateurs, statistiques, chat en direct, rediffusions) · **scène composée par
ffmpeg** et encodage sur la puce vidéo : 306 % de processeur avant, 105 % après, en 30 images
par seconde au lieu de 25.

### Prochain chantier — YouTube au même niveau que Twitch
Aujourd'hui YouTube n'est qu'une **destination RTMP** : on peut y pousser le flux si on colle
la clé à la main, rien de plus. Tout ce qui a été fait pour Twitch reste à faire.

Ce que ça demande, et en quoi ce n'est **pas** un simple copier-coller de Twitch :

- [ ] **Autorisation Google**, pas un flux d'appareil : passage par la Google Cloud Console,
      création d'un projet, écran de consentement, portées `youtube` et `youtube.force-ssl`.
      Plus lourd que Twitch, et l'écran de consentement doit être configuré même pour un
      usage personnel.
- [ ] **La clé de diffusion** se lit par `liveStreams.list` (`cdn.ingestionInfo.streamName`).
- [ ] **Différence de fond avec Twitch** : sur YouTube il faut **créer une diffusion**
      (`liveBroadcasts.insert`) et la lier au flux avant que la clé serve à quelque chose.
      Twitch accepte un flux poussé sans rien déclarer, YouTube non. C'est ce qui change le
      plus dans le pilotage : démarrer, c'est aussi créer et passer l'événement en direct.
- [ ] **Titre, description, visibilité** par `liveBroadcasts.update`.
- [ ] **Chat** : utiliser `liveChatMessages.streamList`, qui **pousse** les messages, et non
      `liveChatMessages.list` interrogé en boucle — voir le quota ci-dessous.
- [ ] **Le point dur : le quota.** L'API YouTube alloue **10 000 unités par jour** par défaut,
      toutes opérations confondues. Une interrogation régulière du chat épuise ça en quelques
      heures. À concevoir en conséquence dès le départ (méthode qui pousse, cadence prudente),
      et prévoir une demande d'augmentation de quota si nécessaire.
- [ ] **Activer le direct sur la chaîne** — 24 h de délai la première fois, à anticiper.
- [ ] Statistiques et rediffusions YouTube, une fois le reste en place.

### Reste à faire, hors YouTube
- [ ] **Générer un vrai corpus de secours.** Il ne fait qu'un fichier de 40 s : si le
      navigateur tombe, le repli tourne en boucle très courte. Une à deux heures suffisent
      (temps réel : une heure de musique = une heure).
- [ ] Vérifier le **renouvellement du jeton Twitch** après expiration — écrit d'après la
      documentation, jamais observé.
- [ ] Porter les crédits (`CREDITS.md`) dans la description de la chaîne.
- [ ] `60 i/s` coûte le double de processeur pour un fond quasi immobile — envisager 30.

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
