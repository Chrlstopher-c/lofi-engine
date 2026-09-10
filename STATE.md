# STATE — LoFi Engine
*Dernière mise à jour : 2026-09-10*

## Résumé de l'état actuel
Générateur de musique lofi procédurale, en production sur https://lofi.christophercouspeyre.com
depuis le Raspberry Pi, **et diffusé en direct sur Twitch** depuis le PC fixe.

Le projet se pilote entièrement depuis un **centre de contrôle web** (port 4708, lancé par
`./start.sh` à côté du site) : composition de la scène, calques, fonds, profils, clés de
diffusion, démarrage et arrêt, et l'intégration Twitch (compte, clé récupérée automatiquement,
titre, catégorie, spectateurs, statistiques, chat en direct, rediffusions).

La musique est générée note par note dans un navigateur ; si celui-ci tombe, un corpus
enregistré prend le relais **dans le même puits audio**, si bien que le flux ne se coupe pas.
Mesuré sur une panne provoquée : 3,5 s de trou. Sur une heure de diffusion réelle, aucune
panne ne s'est produite.

**L'image, elle, ne passe plus par le navigateur** : ffmpeg compose la scène lui-même — fond,
voile, incrustations, texte, horloge, **et les accords** — et le navigateur, réduit à la
musique, tourne dans un écran de 360×240 que personne ne regarde. La diffusion est passée de
306 % de processeur à 105 %.

**La musique elle-même se pilote à chaud** depuis un quatrième onglet du centre de contrôle :
dix-sept réglages et quatre couleurs nommées (Équilibré, Nocturne, Atmosphérique, Énergique).
Aucun bouton à valider — le centre de contrôle écrit `corpus/moteur.json`, le moteur le relit
toutes les secondes et demie, le tempo glisse sur six secondes. Rien ne s'interrompt.

## Nature du dépôt
Fork de [meel-hd/lofi-engine](https://github.com/meel-hd/lofi-engine) (MIT, Mehdi El Oualy).
L'amont est déclaré comme remote `upstream` : `git fetch upstream` puis merge pour suivre ses
évolutions. Tous les ajouts Echo vivent à la racine et ne touchent pas au code de l'application —
c'est ce qui garde les merges sans conflit.

## Stack
Svelte 3 + TypeScript + Vite pour l'interface · Tone.js pour la synthèse audio · Tauri 2 pour la
version desktop (amont, non utilisée en production) · Bun pour le serveur statique · Docker pour
le lancement local.

## Ce qui a été fait — session du 2026-09-10

**Interface.** Les trois onglets portés sur le nouveau dessin (deux thèmes, échelles déclarées),
plus un quatrième, **Moteur**, qui pilote la génération musicale en direct. Le panneau Diffusion
dit désormais quel encodeur tourne réellement et ce qu'il coûte, en cœurs.

**Moteur musical.** Trois défauts trouvés en le lisant, tous corrigés : la mélodie marchait sur
la gamme sans savoir quel accord sonnait (elle penche maintenant vers les notes de l'accord) ;
la tonalité se tirait au hasard parmi douze (elle suit le cycle des quintes) ; rien n'était
reproductible (les vingt-sept tirages passent par une graine, repassable dans l'URL). Ajoutés
ensuite : une **basse** synthétisée, une deuxième table d'accords pour le **mineur**, et une
**banque de nappes vocales générée sur cette machine**.

**Voix.** La synthèse par formants a été essayée, mesurée, écoutée et écartée. La banque est
produite en local : ACE-Step (Apache 2.0) engendre le chant, demucs n'en garde que la voix, et
seule la fenêtre où la chanteuse **tient** une note est conservée — une phrase chantée se bat
avec la mélodie du moteur, une note tenue s'y pose. Chaîne dans `outils/vox/`, provenance dans
`CREDITS.md`. Aucune licence tierce.

**Diffusion.** L'arrêt du flux attend maintenant que ffmpeg ait vraiment fermé sa connexion
(sinon deux émetteurs sur la même clé, et Twitch refuse les deux) ; le garde-fou qui abaisse la
définition vaut aussi quand ffmpeg compose ; l'attente du serveur audio passe de 20 à 45 s ; et
**la clé de diffusion est masquée** dans les journaux, où ffmpeg la recopiait en clair.

**Machine.** Un fond d'écran animé fuyait — `mpvpaper` tenait 11,3 Gio après 39 h. Relancé :
475 Mo, et le swap est repassé de saturé à 10 Gio libres.

## Ce qui a été fait — session du 2026-09-09
- Clone, mesure de consommation, déploiement sur le Pi, fork mis aux normes Echo, dockerisation.
- **Diffusion 24/7** : scène composée en calques, capture du corpus, diffusion en direct avec
  repli automatique, le tout en conteneurs.
- **Centre de contrôle web** : scène, calques, fonds, aperçu en temps réel, mode composition,
  profils, clés, démarrage et arrêt, journal.
- **Intégration Twitch** : autorisation par code d'appareil, clé de diffusion récupérée
  automatiquement, titre et catégorie, état du direct, statistiques, chat en direct,
  rediffusions.
- **Vidéos et GIF** dans la scène, et un outil de téléchargement de fonds animés par l'API
  Pixabay, avec traçabilité de chaque fichier.
- Licences des échantillons audio tracées : deux attributions dues, aucun remplacement.
- 127 Go libérés sur `/mnt/projects` (caches de compilation Rust de projets dormants).

## Stream 24/7 — en service
Détail, mode d'emploi et tableau des mesures : `docs/STREAM-24-7.md`. Licences des
échantillons : `CREDITS.md`. Sources de fonds animés : `docs/FONDS-ANIMES.md`.

Trois profils Docker : `generateur` (enregistre le corpus), `direct` (le mode retenu), et
`diffusion` (corpus en boucle, sans navigateur). Rien ne s'installe sur la machine hôte.

Une seule source de vérité pour la scène : `corpus/scene.json`, écrit par le centre de
contrôle et relu par la scène toutes les 3 secondes — donc une modification se voit à
l'antenne sans redémarrage. Les réglages de scène ont été retirés du `.env`, où ils
écrasaient ce fichier.

**Ce qui reste à faire** est dans `TODO.md` : YouTube au même niveau que Twitch (autorisation
Google, création de diffusion obligatoire, quota de 10 000 unités par jour), et un vrai
corpus de secours — il ne fait aujourd'hui qu'un fichier de 40 secondes.

## Décisions prises
| Décision | Raison | Date |
|---|---|---|
| Héberger en site statique, pas en app Tauri | Toute la synthèse audio tourne chez le visiteur ; le serveur ne sert que des fichiers. 28 Mo de RAM constants sur le Pi | 2026-09-09 |
| Le build ne tourne jamais sur le Pi | 1 891 Mo de pic mémoire mesuré, contre 455 Mo disponibles à l'époque | 2026-09-09 |
| Serveur maison plutôt qu'un serveur statique tout fait | Les mp3 sont lus en streaming : le navigateur les demande par tranches (requêtes Range) | 2026-09-09 |
| Docker en local, systemd direct en production | Le Pi ne peut pas construire l'image ; le dockeriser supposerait un registre | 2026-09-09 |
| Conteneur publié sur `0.0.0.0` | Demande explicite : joignable depuis le réseau, pas seulement en localhost | 2026-09-09 |
| README de l'amont conservé tel quel | Le remplacer par la charte Echo casserait les merges depuis upstream | 2026-09-09 |
| `console.log` conservé malgré le linter | Même pattern que les autres serveurs statiques du Pi ; systemd capture la sortie. Pino pour deux lignes serait une dépendance pour rien | 2026-09-09 |
| Génération en direct plutôt que corpus en boucle | Choix de Chris. Musique réellement infinie ; le repli sur corpus couvre la fragilité du navigateur | 2026-09-09 |
| Le corpus est rejoué **dans le même puits audio** | ffmpeg ne s'arrête jamais, donc la connexion RTMP tient et les plateformes ne voient aucune coupure | 2026-09-09 |
| Surveillance à deux vitesses | Une cadence unique laissait 32 s de silence avant de voir la panne ; séparer la veille du navigateur (2 s) de la mesure de niveau ramène le trou à 3,5 s | 2026-09-09 |
| La scène est décrite en HTML mais **composée par ffmpeg** | Le HTML reste la façon d'éditer et de prévisualiser ; l'afficher en 1080p pour le recapturer coûtait 167 % de processeur, contre 83 % en composant directement. Un traducteur lit `scene.json` et en fait une chaîne de filtres | 2026-09-09 |
| L'encodage passe sur la puce vidéo quand il y en a une | 96 % d'un cœur en logiciel contre 20 % sur la carte, mesuré sur la même source en temps réel. Chaque profil est essayé pour de vrai avant d'être retenu | 2026-09-09 |
| Le voile et le vignettage sont calculés une fois, pas à chaque image | Les recalculer image par image coûtait 69 points de processeur ; une image transparente superposée fait le même rendu | 2026-09-09 |
| Une image fixe superposée est lue à 1 image par seconde | La relire à la cadence du flux coûtait 130 points, pour un contenu qui ne change jamais | 2026-09-09 |
| Un calque que ffmpeg ne sait pas rendre fait repasser par le navigateur | Les accords viennent du moteur musical, que ffmpeg ne voit pas. Mieux vaut une scène complète et chère qu'une scène légère et amputée | 2026-09-09 |
| La définition s'abaisse d'elle-même sur une machine trop juste | Sans puce vidéo et sous six cœurs, le 1080p logiciel ne décroche pas franchement : il s'étrangle jusqu'à ce que quelque chose meure | 2026-09-09 |
| `corpus/scene.json` seule source de vérité | Les mêmes réglages dans le `.env` l'écrasaient : un titre changé restait figé à l'écran | 2026-09-09 |
| Seule la page en mode aperçu accepte d'être pilotée | Sinon n'importe quelle page ouverte pourrait détourner l'antenne | 2026-09-09 |
| Le son des vidéos est coupé de force | Le flux capture l'audio du navigateur : une bande-son se mélangerait à la musique | 2026-09-09 |
| Flux d'appareil pour Twitch, pas de redirection | La console Twitch refuse `http://localhost` malgré sa documentation ; monter du HTTPS pour une app locale serait disproportionné | 2026-09-09 |
| Le Client ID est livré avec le projet | Il n'est pas secret, Twitch le transmet en clair. Qui clone n'a rien à créer : il connecte son propre compte | 2026-09-09 |
| Le centre de contrôle tourne hors conteneur | Il pilote Docker et écrit le `.env` : lui donner le socket dans un conteneur reviendrait à lui donner la machine | 2026-09-09 |
| Le moteur se pilote par un fichier relu à chaud, comme la scène | Le mécanisme existait déjà pour `scene.json` : en inventer un second (WebSocket, événements) aurait ajouté une infrastructure pour une latence dont un curseur n'a pas besoin | 2026-09-10 |
| Le schéma des réglages vit dans le moteur, importé par le centre de contrôle | Deux copies de la même table de bornes divergent au premier réglage ajouté, et le serveur accepterait alors une valeur que le moteur refuse sans que personne ne le voie | 2026-09-10 |
| Un ordre explicite sur un instrument prend effet sur-le-champ | « Toujours » et « jamais » attendaient la section suivante, soit jusqu'à 80 s. « Au gré des sections » continue d'attendre : c'est son sens | 2026-09-10 |
| La mélodie penche vers les notes de l'accord en cours | Elle marchait sur la gamme de la tonalité sans rien savoir de l'harmonie : elle pouvait frotter, par hasard et jamais par choix | 2026-09-10 |
| Les modulations suivent le cycle des quintes | Tirer parmi douze donnait une chance sur six de sauter d'un triton — la rupture s'entend. Les voisines partagent presque toutes leurs notes | 2026-09-10 |
| Le cinquième degré du mineur est pris en dominante | C'est le seul accord qui résout vraiment vers le i ; en mineur naturel la progression tourne sans jamais se poser | 2026-09-10 |
| Les voix sont **générées ici**, pas empruntées | Aucune bibliothèque de voix féminine tenue, échantillonnée note par note, sous une licence autorisant un flux public 24/7 (recherche tracée dans `CREDITS.md`). ACE-Step est en Apache 2.0 : ce qu'il produit ici n'appartient qu'à nous | 2026-09-10 |
| On extrait la **tenue**, pas la phrase | Une phrase chantée est une mélodie, et deux mélodies qui ne se connaissent pas se bagarrent. Aucun réglage de volume n'y change rien | 2026-09-10 |
| Le pad de synthé est supprimé, le piano résonne à sa place | C'était une dent de scie désaccordée dans un passe-bas — le son de synthé bon marché, identifié à l'oreille comme gênant. La vraie queue du piano comble le même creux, sans une voix de plus à calculer | 2026-09-10 |
| La clé de diffusion est masquée à la source dans les journaux | ffmpeg recopie l'URL complète dans ses messages d'erreur ; elle sortait en clair dans `docker logs`, que l'on colle volontiers pour demander de l'aide. C'est arrivé deux fois le même jour | 2026-09-10 |
| L'arrêt du flux attend que le groupe de processus soit vide | La boucle rend la main avant que ffmpeg ait fermé sa connexion RTMP : repartir à cet instant met deux émetteurs sur la même clé, et la plateforme les refuse tous les deux | 2026-09-10 |
| Chat relayé par interrogation, pas par flux poussé | Une seconde connexion longue dans le navigateur, avec son cycle de vie, pour une latence dont un chat n'a pas besoin | 2026-09-09 |

## Contexte non-évident
- **Ports** : 4707 en local, 8794 en production sur le Pi. Le 4707 a été choisi parce qu'aucun
  `.echoforge.yml` de `/mnt/projects` ne le déclarait.
- **`vmdocker` n'existe pas.** Une compatibilité a été codée puis retirée : le paquet réellement
  proposé par apt s'appelle `wmdocker`, un dock Window Maker sans rapport avec les conteneurs.
  Apt le suggère parce que sur Debian le paquet Docker s'appelle `docker.io` — `apt install
  docker` échoue et apt propose le nom le plus proche de sa base.
- **`hostname -I` n'existe pas sur Arch.** Une première version de `start.sh` l'utilisait et
  mourait juste après un démarrage pourtant réussi, annonçant un échec. L'IP se lit via
  `ip route get`.
- **Le projet a migré avec le reste du Pi** vers `/mnt/projects` (disque externe) le même jour.
  L'unité systemd pointe vers ce chemin, plus vers `/home/pi`.
- Poids par visiteur : 12,5 Mo transférés et 45 requêtes au premier chargement.

## Le centre de contrôle, aujourd'hui

Quatre onglets — Scène, **Moteur**, Diffusion, Twitch — sur un système visuel unique : jetons de
couleur, thèmes clair et sombre, échelles typographiques et d'espacement, hauteurs de contrôle.
`heritage.css` est tombé de 238 à 111 lignes.

Le portage des trois premiers panneaux a été fait par deux agents, sous une règle qui reste
valable si on relance ce genre de chantier : **ils n'écrivent aucune ligne de CSS** — un seul
propriétaire du système visuel, sinon les collisions sont ingérables — et **aucun d'eux ne valide
son travail**, c'est le rôle du parent. Trois noms étaient entrés en collision et ont été
arbitrés : `.composition` reste la surcouche d'édition (la carte enregistrée est
`.composition-carte`), `.etiquette` reste l'ancien badge (celle du canevas est
`.etiquette-selection`), et `.vignette` a pris le dessin de la maquette.

L'onglet **Moteur** pilote la génération musicale sans rien interrompre : quatre couleurs
nommées et dix-sept réglages, écrits dans `corpus/moteur.json` et relus par le moteur toutes les
secondes et demie. Vérifié en direct — une page chargée **une seule fois** est passée de
*nocturne* à *énergique* puis à *atmosphérique* par la seule réécriture du fichier, son compteur
de navigations restant à 1.

## Prochaines étapes
1. **Découper `PlayButton.svelte`** — 753 lignes contre 500 autorisées. C'est le prix d'y avoir
   câblé la basse, la voix, le mineur et les réglages. Le découpage naturel sépare le moteur
   musical du composant Svelte ; il touche à tout, donc à faire à froid.
2. **YouTube au même niveau que Twitch** — décrit dans `TODO.md` : autorisation Google plus
   lourde, obligation de créer une diffusion avant que la clé serve, quota de 10 000 unités par
   jour qui contraint la conception du chat dès le départ.
3. **Enregistrer un vrai corpus de secours** — un seul fichier de 40 s aujourd'hui, donc le repli
   n'a presque rien à jouer si le navigateur tombe. C'est la seule faiblesse réelle du montage.
4. Trancher le sort du README (amont conservé, ou charte Echo via le skill `readme`).

## Points en suspens
- Le README n'est pas tranché.
- La production sur le Pi ne passe pas par Docker, contrairement au local — écart assumé.
- **Le renouvellement du jeton Twitch n'a jamais été observé.** Le flux d'appareil n'a pas de
  secret client ; le renouvellement est écrit d'après la documentation. Si le compte se
  déconnecte un jour, c'est là qu'il faut regarder — une reconnexion prend dix secondes.
- **La suppression d'une rediffusion n'a pas été exercée** : elle est irréversible et sur un
  vrai compte.
- **`PlayButton.svelte` fait 753 lignes** contre 500 autorisées — dette assumée, notée en tête
  des prochaines étapes.
- **Twitch exige un numéro de téléphone vérifié pour diffuser**, et le numéro utilisé pour la
  double authentification ne compte pas : ce sont deux registres distincts. Une heure perdue le
  2026-09-10 à écarter la clé, le réseau et notre propre chaîne, alors que l'API le disait en une
  phrase. D'où la sonde `stream/controle/twitch/aptitude.ts`, qui interroge Twitch et rend la
  vraie cause quand le RTMP ne renvoie qu'« Input/output error ».
- **Définir un mot de passe Twitch révoque tous les jetons OAuth et fait tourner la clé de
  diffusion.** Après cette opération, il faut réautoriser puis récupérer la nouvelle clé, et
  recréer le conteneur pour qu'il la prenne.
- **L'installation de l'ami est toujours bloquée** : chaîne locale saine (la définition s'abaisse
  bien, pulseaudio démarre), Twitch refuse l'ingestion. Piste à vérifier de son côté : numéro
  vérifié sur *son* compte. Il n'a par ailleurs aucun corpus de secours.
- **VAAPI n'a jamais été exercé sur du vrai matériel Intel** : la machine de développement n'a
  qu'une carte NVIDIA. Le profil est écrit et testé négativement (il est bien refusé quand la
  puce est absente), jamais positivement.
- **Une machine virtuelle Proxmox n'a pas accès à la puce vidéo de son hôte.** Sur ce type
  d'installation, l'encodage matériel restera indisponible tant que le projet tournera dans une
  VM plutôt que dans un conteneur LXC.
