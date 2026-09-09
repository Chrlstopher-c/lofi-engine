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
├── scripts/
│   └── optimize-backgrounds.sh        compression des fonds d'écran
└── screenshots/                       captures utilisées par le README amont
```
