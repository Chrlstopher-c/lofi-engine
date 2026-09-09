# Arborescence — LoFi Engine
*Dernière mise à jour : 2026-09-09*

Les fichiers marqués **⬤** sont les ajouts Echo ; tout le reste vient de l'amont.

```
lofi-engine/
├── start.sh                        ⬤ construit si besoin, puis sert dist/ sur le port 4707
├── stop.sh                         ⬤ arrête le serveur par son PID enregistré
├── restart.sh                      ⬤ stop puis start, remet les logs à zéro
├── deploy-pi.sh                    ⬤ build, envoi vers le Pi, vérification de la réponse
├── Dockerfile                      ⬤ image en deux étapes : build Vite, puis serveur seul
├── docker-compose.yml              ⬤ service, port publié sur 0.0.0.0, redémarrage auto
├── .dockerignore                   ⬤ exclut node_modules, dist, .git du contexte de build
├── docker-cli.sh                   ⬤ détecte le client Docker et la commande d'installation
├── server.ts                       ⬤ serveur statique Bun, gère les requêtes Range des mp3
├── .echoforge.yml                  ⬤ fiche d'identité lue par Atrium
├── .env.example                    ⬤ variables d'environnement, sans valeurs sensibles
├── STATE.md                        ⬤ état du projet, décisions, cross-session
├── TODO.md                         ⬤ tâches en cours et backlog
├── ARBORESCENCE.md                 ⬤ ce fichier
├── ARCHITECTURE.md                 ⬤ domaines, découpage, environnements
├── README.md                          documentation de l'auteur amont
├── CONTRIBUTING.md                    guide de contribution amont
├── LICENSE                            MIT — Mehdi El Oualy, 2025
├── index.html                         page hôte, point d'entrée Vite
├── package.json                       dépendances et scripts (dev, build, tauri)
├── vite.config.ts                     configuration Vite + plugin Svelte
├── tsconfig.json                      configuration TypeScript
├── docs/
│   └── STREAM-24-7.md              ⬤ conception du stream continu Twitch + YouTube
├── logs/                           ⬤ sortie du serveur local (non versionné)
├── dist/                              site construit par Vite (non versionné)
│
├── src/                               application Svelte
│   ├── main.ts                        amorçage de l'application
│   ├── App.svelte                     composant racine, orchestre l'ensemble
│   ├── styles.css                     styles globaux
│   └── lib/
│       ├── Config.svelte              panneau de configuration général
│       ├── PlayButton.svelte          bouton lecture/pause principal
│       ├── localDB.ts                 persistance des réglages dans le navigateur
│       ├── engine/                    moteur de synthèse audio (Tone.js)
│       │   ├── Chords/                génération des progressions d'accords
│       │   │   ├── Chord.ts           un accord et ses notes
│       │   │   ├── Chords.ts          fabrique d'accords
│       │   │   ├── ChordProgression.ts enchaînement des accords dans le temps
│       │   │   ├── IntervalWeights.ts  pondération des intervalles au tirage
│       │   │   ├── Keys.ts            tonalités disponibles
│       │   │   └── MajorScale.ts      gamme majeure de référence
│       │   ├── Drums/                 batterie synthétisée
│       │   │   ├── Kick.ts            grosse caisse
│       │   │   ├── Snare.ts           caisse claire
│       │   │   ├── Hat.ts             charleston
│       │   │   └── Noise.ts           bruit de fond, texture
│       │   └── Piano/
│       │       ├── Piano.ts           instrument piano
│       │       └── Samples.ts         échantillons de notes
│       ├── components/
│       │   ├── Controls/              réglages d'ambiance
│       │   │   ├── index.svelte       conteneur des contrôles
│       │   │   ├── Rain/              pluie (son + animation)
│       │   │   ├── Thunder/           orage
│       │   │   ├── CampFire/          feu de camp
│       │   │   ├── Jungle/            jungle
│       │   │   └── Settings/          volume, fond, DJ automatique
│       │   ├── TopBar/                barre de fenêtre (Tauri et navigateur)
│       │   ├── TrackList/             liste des pistes
│       │   ├── Visualizer/            visualisation du son
│       │   ├── InfoBox/               aide, raccourcis, liens
│       │   ├── ContextMenu/           menu au clic droit
│       │   └── Tooltip.svelte         infobulles
│       └── locales/                   traductions (en, fr, ja, ru, zh, hi, nl)
│
├── src-tauri/                         coquille desktop Tauri 2
│   ├── src/                           point d'entrée Rust
│   ├── Cargo.toml                     dépendances Rust
│   ├── tauri.conf.json                configuration de l'application desktop
│   ├── capabilities/                  permissions accordées à la webview
│   └── icons/                         icônes par plateforme
│
├── public/                            servi tel quel
│   ├── assets/engine/tracks/          ambiances longues (mp3)
│   ├── assets/engine/effects/         effets ponctuels (mp3)
│   ├── assets/images/                 illustrations
│   ├── assets/background/             fonds d'écran (webp)
│   └── LofiEngine.png                 logo
│
├── docker-compose.nvidia.yml          accès à la carte NVIDIA, ajouté automatiquement
├── docker-compose.dri.yml             accès à la puce vidéo Intel/AMD, idem
├── maquettes/                         dessins du centre de contrôle, avant portage
│   ├── centre-controle.html           première proposition
│   └── centre-controle-v2.html        version aboutie, thèmes clair et sombre
│
├── stream/                            diffusion en continu (docs/STREAM-24-7.md)
│   ├── Dockerfile.navigateur          image chromium + écran virtuel + audio + ffmpeg
│   ├── Dockerfile.diffuseur           image ffmpeg seul, pour le mode sans navigateur
│   ├── base.sh                        journalisation, partagée par tous les scripts
│   ├── commun.sh                      config des plateformes, sortie RTMP, playlist
│   ├── navigateur.sh                  écran virtuel, puits audio, pilotage du navigateur
│   ├── materiel.sh                    détecte la puce vidéo de la machine hôte
│   ├── direct/direct.sh               diffusion en direct + repli sur le corpus
│   ├── direct/composition.sh          choisit qui dessine la scène, ffmpeg ou le navigateur
│   ├── direct/composer.py             traduit scene.json en chaîne de filtres ffmpeg
│   ├── polices/scene-titre.ttf        Source Serif 4 Display Light, pour ffmpeg
│   ├── polices/scene-texte.ttf        Source Serif 4 Regular, pour ffmpeg
│   ├── polices/LICENCE.txt            SIL OFL 1.1 des deux polices ci-dessus
│   ├── generateur/capturer.sh         enregistre le corpus en FLAC
│   └── diffuseur/diffuser.sh          lit le corpus en boucle, sans navigateur
│
├── stream/controle/                   centre de contrôle — interface web, port 4708
│   ├── serveur.ts                     routes de l'API et service de l'interface
│   ├── types.ts                       modèle de la scène et de la diffusion
│   ├── journal.ts                     journalisation (pino)
│   ├── scene.ts                       lecture, validation et écriture de la scène
│   ├── scene-defaut.json              scène de référence, livrée avec le projet
│   ├── profils.ts                     scènes nommées : enregistrer, charger, supprimer
│   ├── diffusion.ts                   plateformes, clés et encodage dans le .env
│   ├── pilotage.ts                    démarrage, arrêt, état, construction de l'image
│   ├── fonds.ts                       images et vidéos de fond déposées
│   ├── twitch/
│   │   ├── transport.ts               couche HTTP isolée, remplaçable pour les tests
│   │   ├── chat-transport.ts          couche WebSocket isolée, idem
│   │   ├── valider.ts                 lecture défensive des réponses Twitch
│   │   ├── coffre.ts                  Client ID et jetons, hors dépôt, en 0600
│   │   ├── jeton.ts                   renouvellement par jeton de rafraîchissement
│   │   ├── client.ts                  appels Helix, reprise unique sur 401
│   │   ├── appareil.ts                autorisation par code d'appareil
│   │   ├── chaine.ts                  titre, catégorie, état du direct
│   │   ├── cle-diffusion.ts           récupération de la clé vers le .env
│   │   ├── irc.ts                     analyse du protocole de chat
│   │   ├── chat.ts                    connexion, reconnexion bornée, état
│   │   ├── chat-tampon.ts             tampon borné des derniers messages
│   │   ├── chat-envoi.ts              envoi, avec plafond de débit
│   │   ├── statistiques.ts            spectateurs, abonnés, pic, moyenne
│   │   ├── historique.ts              relevés échantillonnés, fenêtre glissante
│   │   ├── rediffusions.ts            liste et suppression des archives
│   │   ├── archivage.ts               suppression automatique, non rétroactive
│   │   └── routes.ts                  bord HTTP du domaine Twitch
│   └── ui/                            interface React (Scène · Diffusion · Twitch)
│       ├── App.tsx                    en-tête, onglets, bascule de thème, état
│       ├── styles.css                 assemble les feuilles de styles/
│       ├── styles/socle.css           jetons, thèmes clair et sombre, échelles
│       ├── styles/coquille.css        en-tête, onglets, panneaux, grilles de page
│       ├── styles/controles.css       champs, curseurs, bascules, sélecteurs
│       ├── styles/boutons.css         boutons, badges, barres d'outils
│       ├── styles/retours.css         avis, dialogues, états vides, mesures
│       ├── styles/scene.css           galerie, canevas, surcouches d'édition
│       ├── styles/scene-calques.css   pile de calques, éditeur, compositions
│       ├── styles/diffusion.css       pilotage, destinations, journal
│       ├── styles/twitch.css          chaîne, courbe, rediffusions, chat
│       ├── styles/heritage.css        anciennes classes, à vider au fil du portage
│       ├── commun/                    API, formats, éditeur, composants partagés
│       ├── commun/Icones.tsx          jeu d'icônes en sprite SVG
│       ├── commun/useTheme.ts         thème clair ou sombre, retenu localement
│       ├── scene/                     fond, calques, aperçu, composition
│       ├── profils/                   enregistrer et charger une scène
│       ├── diffusion/                 plateformes, encodage, pilotage, journal
│       └── twitch/                    compte, chaîne, chat, statistiques, archives
│
├── outils/
│   └── telecharger-fonds.ts           récupère des boucles depuis l'API Pixabay
│
├── corpus/                            audio capté, fonds, scène, profils (ignoré par git)
│
├── CREDITS.md                         origine et licence de chaque échantillon audio
│
├── scripts/
│   └── optimize-backgrounds.sh        compression des fonds d'écran
└── screenshots/                       captures utilisées par le README amont
```
