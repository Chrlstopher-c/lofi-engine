# STATE — LoFi Engine
*Dernière mise à jour : 2026-09-09*

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
voile, incrustations, texte, horloge — et le navigateur, réduit à la musique, tourne dans un
écran de 360×240 que personne ne regarde. La diffusion est passée de 306 % de processeur à
105 %, en 1080p **30** images par seconde au lieu de 25.

## Nature du dépôt
Fork de [meel-hd/lofi-engine](https://github.com/meel-hd/lofi-engine) (MIT, Mehdi El Oualy).
L'amont est déclaré comme remote `upstream` : `git fetch upstream` puis merge pour suivre ses
évolutions. Tous les ajouts Echo vivent à la racine et ne touchent pas au code de l'application —
c'est ce qui garde les merges sans conflit.

## Stack
Svelte 3 + TypeScript + Vite pour l'interface · Tone.js pour la synthèse audio · Tauri 2 pour la
version desktop (amont, non utilisée en production) · Bun pour le serveur statique · Docker pour
le lancement local.

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

## Reprise immédiate — portage du dessin du centre de contrôle
*Chantier en cours au 2026-09-09 21 h. Cette section disparaît quand il est fini.*

Le **socle est posé et poussé** : jetons de couleur, thèmes clair et sombre, échelles
typographiques et d'espacement, hauteurs de contrôle, briques communes (`ui/styles/`,
`ui/commun/`, `App.tsx`). Vérifié dans un navigateur : zéro erreur en console, le basculeur
de thème fonctionne dans les deux sens et retient le choix.

**Deux agents portaient les panneaux** au moment de la coupure : l'un sur `ui/scene/`,
l'autre sur `ui/diffusion/` et `ui/twitch/`. Consigne qui leur a été donnée, à maintenir si
on les relance : **ils n'écrivent aucune ligne de CSS** — un seul propriétaire du système
visuel, sinon les collisions sont ingérables — et **aucun d'eux ne valide son travail**,
c'est le rôle du parent.

Ce qu'il reste, dans l'ordre :
1. Récupérer ce que les deux agents ont produit (ou relancer le portage panneau par panneau).
2. Construire l'interface : `cd stream/controle && bun run build-ui`.
3. **Vérifier par le chemin réel** : ouvrir `http://127.0.0.1:4708/`, zéro erreur en console,
   les trois onglets, le basculeur de thème, et une action réelle par panneau.
4. Retirer de `ui/styles/heritage.css` les anciennes classes devenues inutiles.
5. Commit, push, et supprimer cette section.

À savoir : `heritage.css` porte les anciennes classes encore employées par les panneaux non
portés, réécrites en jetons. Trois noms sont entrés en collision avec la maquette et ont été
arbitrés — `.composition` reste la surcouche d'édition (la carte enregistrée est
`.composition-carte`), `.etiquette` reste l'ancien badge (celle du canevas est
`.etiquette-selection`), et `.vignette` a pris le dessin de la maquette.

## Prochaines étapes
1. **YouTube au même niveau que Twitch** — le chantier est décrit dans `TODO.md`, avec ce qui
   diffère réellement : autorisation Google plus lourde, obligation de créer une diffusion
   avant que la clé serve, et un quota de 10 000 unités par jour qui contraint la conception
   du chat dès le départ.
2. **Enregistrer un vrai corpus de secours** — il ne fait qu'un fichier de 40 s, donc le repli
   n'a presque rien à jouer si le navigateur tombe. Une à deux heures suffisent, en temps réel.
   C'est aujourd'hui la seule faiblesse réelle du montage.
3. Trancher le sort du README (amont conservé, ou charte Echo via le skill `readme`).

## Points en suspens
- Le README n'est pas tranché.
- La production sur le Pi ne passe pas par Docker, contrairement au local — écart assumé.
- **Le renouvellement du jeton Twitch n'a jamais été observé.** Le flux d'appareil n'a pas de
  secret client ; le renouvellement est écrit d'après la documentation. Si le compte se
  déconnecte un jour, c'est là qu'il faut regarder — une reconnexion prend dix secondes.
- **La suppression d'une rediffusion n'a pas été exercée** : elle est irréversible et sur un
  vrai compte.
- **Le calque « accords » n'est pas composable par ffmpeg** : sa valeur naît dans le moteur
  musical, à l'intérieur du navigateur. Une scène qui en contient repasse donc par l'ancien
  chemin, plus coûteux. Le mécanisme qui le débloquerait existe déjà — la date est écrite dans
  un fichier que ffmpeg relit à chaque image ; il suffirait que le moteur y écrive l'accord.
- **VAAPI n'a jamais été exercé sur du vrai matériel Intel** : la machine de développement n'a
  qu'une carte NVIDIA. Le profil est écrit et testé négativement (il est bien refusé quand la
  puce est absente), jamais positivement.
- **Une machine virtuelle Proxmox n'a pas accès à la puce vidéo de son hôte.** Sur ce type
  d'installation, l'encodage matériel restera indisponible tant que le projet tournera dans une
  VM plutôt que dans un conteneur LXC.
