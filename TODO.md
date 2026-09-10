# TODO — LoFi Engine
*Dernière mise à jour : 2026-09-10*

## En cours
- [ ] **Découper `PlayButton.svelte`** — 753 lignes contre 500. Séparer le moteur musical du
      composant Svelte. Touche à tout ce qui vient d'être vérifié : à faire à froid.
- [ ] **Passer cette installation à 4500k** — le défaut du projet l'est désormais, mais le
      `.env` d'ici fixe encore 1500k, et cette scène a les mêmes dégradés sombres que celle qui
      partait en blocs. Compter 9,4 Mbit/s montants pour deux destinations. Décision de tuyau.
- [ ] **Reprendre le blocage YouTube de l'ami à froid** — bloqué sur « préparation du flux »
      alors que Twitch accepte le même flux. Tout ce qui se mesurait de notre côté a été mesuré
      et son flux est conforme : H.264 High, images-clés à 0, 2 et 4 s, 1080p30. Ce qui reste
      est chez la plateforme, et on n'a pas les yeux pour le voir sans son API.
- [ ] **Enregistrer un vrai corpus de secours** — un seul fichier de 40 s, donc le repli n'a
      presque rien à jouer si le navigateur tombe. Seule faiblesse réelle du montage.
- [ ] **Un corpus de secours chez l'ami** — il diffuse maintenant, mais sans filet.

## Fait le 2026-09-10
- [x] **Socle du nouveau dessin** — jetons, thèmes clair et sombre, échelles, briques communes.
- [x] **Porter les panneaux sur ce socle** — `ui/scene/`, `ui/diffusion/`, `ui/twitch/`.
      Vérifié dans un navigateur, diffusion en cours, zéro erreur en console.
- [x] **Élaguer `ui/styles/heritage.css`** — 238 → 111 lignes, il ne reste que ce qui sert.
- [x] **Diffuser sur Twitch et YouTube en même temps** — trois causes indépendantes levées :
      le muxer `tee` de ffmpeg 5.1 refusé par Twitch (image en Debian 13), la cadence PAL qui
      fait carrer YouTube (30 i/s), et la puce vidéo inaccessible dans un LXC.
- [x] **Outiller le diagnostic** — `scripts/verifier-gpu.sh` (neuf contrôles, correction guidée),
      `scripts/lxc-gpu-hote.sh` (mappage calculé côté Proxmox, avec réparation),
      `scripts/sonder-format.sh` (ce que le flux émet vraiment, sans reconstruire).
- [x] **Nommer la destination qui tombe** — `stream/direct/tamis.sh` : `tee` en abandonne une en
      silence, et masque au passage la clé de diffusion que ffmpeg recopie en clair.
- [x] **Sonde Twitch dans l'interface** — aptitude du compte, et comparaison de la clé
      enregistrée avec celle de la chaîne connectée, sans jamais en afficher aucune.
- [x] **Onglet Pixabay** — recherche images et vidéos, favoris sans téléchargement, dépôt dans
      le corpus avec provenance, aperçu en grand, pagination.
- [x] **Débloquer l'installation de l'ami** — puce Intel passée par l'hôte Proxmox, groupe
      mappé, pilotes VAAPI ajoutés à l'image, et 1080p retrouvé.
- [x] **Pilotes VAAPI dans l'image** — Debian n'installe que `libva` avec ffmpeg. Sans pilote,
      `h264_vaapi` ne s'initialise jamais et l'encodage retombe en logiciel, pendant que
      l'interface annonce « VAAPI disponible » parce que l'hôte, lui, en a.
- [x] **Variantes d'encodage pour les petites puces Intel** — elles n'encodent que par la voie
      basse consommation, qui n'accepte pas toujours le débit constant. Trois variantes
      essayées dans l'ordre, la dernière hors sélection automatique.
- [x] **Débit par défaut porté à 4500k** — 1500k est un héritage de l'époque « image fixe ».
      Sur des dégradés sombres l'image part en blocs : 0,999440 contre 0,999667, mesuré.
- [x] **Recalibrer le garde-fou de charge** — il était mesuré sur une mire synthétique, quatre
      fois plus chère qu'une scène lofi. `veryfast` coûte 0,73 cœur en 1080p, pas 2,74 : le
      seuil passe de six à quatre cœurs, et le préréglage s'ajuste avant la définition.

## Ce que le dessin attend du serveur
La maquette prévoit des choses que le backend ne sait pas encore dire. Les panneaux les
laissent de côté plutôt que d'afficher du vide décoratif — chacune est une petite tâche
serveur, pas un chantier d'interface.

- [x] **Encodeur retenu et charge du processeur** — le diffuseur dépose `rendu.json` dans le
      corpus au démarrage, le centre de contrôle le lit et mesure la charge du conteneur. Deux
      cases de plus dans le panneau Diffusion : quel encodeur tourne, et ce qu'il coûte.
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

## Moteur musical — ce qui reste
- [x] **Système de types** — quatre couleurs (Équilibré, Nocturne, Atmosphérique, Énergique)
      et dix-sept réglages, pilotés depuis un nouvel onglet Moteur. Aucun bouton à valider :
      le centre de contrôle écrit `corpus/moteur.json`, le moteur le relit toutes les secondes
      et demie et l'applique sans couper la diffusion. Le tempo glisse sur six secondes.
- [ ] **`PlayButton.svelte` fait 753 lignes**, au-delà de la limite de 500. C'est moi qui l'y ai
      amené en y câblant basse, pad, voix, mode mineur et réglages. Le découpage naturel sépare
      le moteur musical du composant Svelte, mais il touche à tout ce qui vient d'être vérifié :
      à faire à froid, pas en fin de séance.
- [x] **Une voix féminine** — plus besoin d'en chercher une : elle est **générée ici**, par
      ACE-Step (Apache 2.0), voix isolée par demucs, tenue extraite par suivi de hauteur.
      Deux couleurs, quatre tonalités, trois prises. Chaîne dans `outils/vox/`, provenance
      dans `CREDITS.md`. Aucune licence tierce.
- [ ] **Élargir la banque** si les 24 nappes finissent par se reconnaître à l'oreille : la
      chaîne se relance en vingt minutes, les invites sont dans `outils/vox/banque.py`.
- [ ] **Alléger les échantillons** — mono et 22 kHz suffiraient à une nappe passée dans un
      passe-bas à 2,4 kHz, et diviseraient par quatre le décodage. Pas urgent : le flux mesure
      zéro coupure en l'état.
- [ ] **Afficher l'arrangement dans la scène** — `window.__lofiArrangement()` expose déjà
      tonalité, mode, instruments actifs et densité. La scène pourrait le montrer à l'antenne.
- [x] **Niveau et coupures vérifiés à l'antenne** — mesuré à la source dans le conteneur :
      **zéro coupure** sur 60 s, voix comprise, contre 0,5 par minute pour l'ancien moteur.
- [x] **Le pad de synthé est supprimé** — identifié à l'oreille comme le son gênant. La queue du
      piano, allongée à 1,6 s, comble le même creux sans une voix de plus à calculer.

## À faire
- [x] **Afficher les accords quand ffmpeg compose** — la page dépose la progression sur le
      serveur du site (`/progression`), un relais la recopie dans un fichier que ffmpeg relit
      à chaque image. Plus aucun calque ne force le retour au navigateur.
      Reste à voir à l'antenne : la ligne est rendue d'un seul tenant, « Am · i IV [v] VII »,
      le degré en cours entre crochets faute de pouvoir le colorer dans un seul tracé.
- [ ] **Exercer VAAPI sur du vrai matériel Intel** — le profil n'a jamais encodé une image sur
      une puce Intel, faute d'en avoir une ici. À faire chez quelqu'un qui en a une.
- [ ] **Passer la diffusion à 30 images par seconde** — le `.env` est encore à 25, hérité de
      l'époque où le processeur encodait. La carte tient les 30 sans effort. Décision de Chris.
- [ ] **Masquer la clé côté centre de contrôle aussi** — elle est masquée dans le journal du
      diffuseur, mais rien ne garantit qu'elle ne ressorte pas ailleurs. À balayer une fois.
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
