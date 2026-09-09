# Stream 24/7 — LoFi Engine vers Twitch et YouTube

*Construit et mis en service le 2026-09-09. **Diffuse réellement sur Twitch** : une heure en
continu sans incident au moment d'écrire ces lignes. Ce qui a été mesuré est au §4, ce qui
reste ouvert au §7.*

Diffuser en continu la musique du moteur, avec une image de fond, sur Twitch et/ou YouTube.
Le choix des plateformes et les identifiants se règlent dans le `.env`, et rien ne s'installe
sur la machine hôte.

---

## 1. Le point dur

**La musique n'existe pas côté serveur.** Elle est synthétisée en direct dans le navigateur par
Tone.js. Il n'y a aucun fichier audio à diffuser : il faut d'abord faire exister ce son quelque
part.

Et le rendu hors-ligne est inaccessible : le moteur câble tous ses instruments sur `Tone.Master`,
un nœud global créé au chargement des modules (`.chain(vol, Tone.Master)` dans `Kick.ts`,
`Piano.ts`…). `Tone.Offline` exige des instruments connectés à un contexte offline ; y arriver
demanderait de refactoriser du code amont, ce qui casserait les merges avec le dépôt d'origine.

**Conséquence : la capture est en temps réel. Une heure de musique coûte une heure.**

## 2. L'architecture retenue — direct, avec repli

Le moteur génère la musique en continu dans un navigateur ; ffmpeg lit cette sortie et la
pousse vers les plateformes. La musique est donc réellement infinie, jamais deux fois la même.

Le risque de ce montage est connu : un navigateur qui doit tenir des semaines finit par
tomber. D'où le repli — **et c'est là que tient toute la conception** : le corpus enregistré
est rejoué **dans le même puits audio** que celui où joue le navigateur. ffmpeg lit ce puits
sans jamais s'arrêter, donc la connexion RTMP ne se coupe pas et les plateformes ne voient
aucune interruption. Le navigateur est relancé en arrière-plan ; dès qu'il rejoue, le repli
s'efface.

| Conteneur | Profil | Quand | Poids |
|---|---|---|---|
| génération de corpus | `generateur` | ponctuel, pour constituer le secours | image 1,4 Go |
| **direct** | `direct` | **permanent** | image 1,4 Go, ~1 Go de mémoire |
| diffusion du corpus seul | `diffusion` | alternative sans navigateur | image 197 Mo |

Le troisième mode reste disponible : pas de navigateur, un seul ffmpeg qui lit des fichiers.
C'est le plus léger et le plus increvable, au prix d'une musique enregistrée plutôt que générée.

Le corpus est mélangé à chaque passe (20 ordres différents avant qu'un ordre se répète).

## 3. Mode d'emploi

```bash
./start.sh
```

Lance le site **et** le centre de contrôle. Tout se pilote ensuite depuis
**http://localhost:4708** — plus rien à faire en ligne de commande.

- **Scène** : image ou vidéo de fond, calques (texte, horloge, accords, image, vidéo), aperçu
  en temps réel, mode composition pour déplacer un calque à la souris, profils.
- **Diffusion** : plateformes, clés, encodage, démarrage et arrêt, journal.
- **Twitch** : connexion du compte, récupération automatique de la clé, titre et catégorie,
  état du direct, rediffusions.

Deux choses restent en ligne de commande, parce qu'elles sont ponctuelles :

```bash
# Enregistrer un corpus de secours (temps réel : une heure de musique = une heure)
docker compose --profile generateur run --rm -e CAPTURE_DUREE=3600 generateur

# Télécharger des fonds animés depuis Pixabay (voir docs/FONDS-ANIMES.md)
bun run outils/telecharger-fonds.ts 2
```

**Première mise en route** : le premier démarrage de la diffusion construit l'image du
diffuseur — 285 Mo de paquets, cinq à dix minutes. L'interface l'annonce et déroule le journal
de construction ; la diffusion part d'elle-même ensuite.

## 4. Ce qui a été mesuré

Toutes ces valeurs viennent d'un flux réellement reçu, d'une interface réellement pilotée ou
d'une réponse réelle de Twitch — jamais d'une lecture de configuration.

### Le flux

| Vérification | Résultat |
|---|---|
| Capture d'une minute | 60,0 s de FLAC à **-24,4 dBFS** (crête -4,2 dB, aucun écrêtage) |
| Flux du mode direct | H.264 1280×720 à 30 i/s · AAC 44,1 kHz stéréo · son à **-24,5 dBFS** |
| Intervalle entre images-clés | **2,00 s**, la limite que Twitch impose |
| **Navigateur tué en pleine diffusion** | flux **non coupé** ; **3,5 s** de trou avant reprise par le corpus, puis retour automatique à la génération |
| Reconnexion après coupure réseau | relance automatique, vérifiée en coupant le serveur RTMP |
| Scène modifiée pendant la diffusion | titre changé et calque masqué **à l'antenne**, sans redémarrage |
| Vidéo dans un calque | animée dans le flux — deux images à 3 s d'écart, comparées **sur la zone du calque seule** pour ne pas confondre avec l'horloge |
| Refus si plateforme ou clé manquante | code 1, message nommant ce qui manque |
| **Diffusion réelle sur Twitch** | une heure en continu, **aucune panne du navigateur**, aucune bascule sur le repli · 1,7 Go de mémoire, ~370 % de processeur en 1080p60 |

### Le centre de contrôle

| Vérification | Résultat |
|---|---|
| Chargement de l'interface | **zéro erreur** de console |
| Modification puis enregistrement | le fichier de scène change sur le disque, et est servi à la scène |
| Modification **sans** enregistrer | l'aperçu suit immédiatement, le fichier reste inchangé |
| Mode composition | un cadre par calque ; cliquer sélectionne bien le calque |
| Profils | un profil enregistré depuis une édition non enregistrée capte bien l'édition en cours, sans toucher à la scène diffusée |
| Refus de démarrage sans plateforme | message du serveur affiché tel quel |
| Clé de diffusion | écrite dans le `.env`, **absente de toute réponse de l'API** (vérifié par recherche de la valeur) |

### Twitch

| Vérification | Résultat |
|---|---|
| Autorisation par code d'appareil | aboutie avec un vrai compte |
| Clé de diffusion | **récupérée automatiquement**, 46 caractères, sans passer par l'affichage |
| État de la chaîne | en direct, spectateurs et durée lus depuis l'API |
| Rediffusions | listées depuis l'API |
| Nombre d'abonnés | accessible sans portée supplémentaire |

Poids du corpus : **environ 400 Mo par heure** en FLAC, sans perte — il n'est encodé qu'une
fois, à la diffusion.

### Ce qui n'est pas prouvé

- **Le renouvellement du jeton Twitch.** Le flux d'appareil n'a pas de secret client ; le
  renouvellement est écrit d'après la documentation mais n'a pas été observé. Si l'onglet
  Twitch annonce un jour que le compte est déconnecté, c'est là qu'il faut regarder — une
  reconnexion prend dix secondes.
- **La suppression d'une rediffusion**, irréversible et sur un vrai compte : non exercée.

## 5. La scène, et qui la dessine

La scène se décrit en HTML — fond, voile, calques de texte, horloge, incrustations — et se
compose dans `corpus/scene.json`, écrit par le centre de contrôle. C'est ce fichier qui fait
foi ; les réglages qui vivaient autrefois dans le `.env` ont été retirés, ils l'écrasaient.

**Deux chemins mènent de ce fichier à l'antenne**, et la diffusion choisit seule.

**ffmpeg compose** (`STREAM_COMPOSITEUR=auto`, le défaut). Un traducteur lit `scene.json` et
en fait une chaîne de filtres : le fond décodé et recadré, la dérive lente, le voile et le
vignettage, les incrustations image, GIF ou vidéo, les textes et l'horloge. Le navigateur
reste — lui seul produit la musique — mais dans un écran de 360×240 que personne ne capture,
sur une page qui ne dessine rien (`scene.html?audio=1`).

**Le navigateur affiche et ffmpeg recapture son écran** — l'ancien chemin. Il sert encore
quand la scène contient un calque que ffmpeg ne sait pas rendre : les **accords**, dont la
valeur naît dans le moteur musical. Mieux vaut une scène complète et chère qu'une scène
légère et amputée. `STREAM_COMPOSITEUR=ffmpeg` force la composition en acceptant la perte,
`navigateur` revient à l'ancien comportement.

### Ce que ça change

| | processeur | images/s |
|---|---|---|
| navigateur affiche, ffmpeg recapture | 306 % | 25 |
| **ffmpeg compose** | **105 %** | **30** |

Mesuré sur la même scène, un flux réel reçu par un serveur RTMP, encodage sur la carte
graphique dans les deux cas. Le détail : le navigateur seul coûtait 167 % pour afficher cette
scène, dont 101 rien que pour décoder la vidéo de fond ; réduit à la musique, il tombe à 30 %.

### Ce qui a rendu la composition rentable

Trois mesures, parce que la première version en ffmpeg coûtait 250 % — pire que le navigateur :

- **Une image fixe superposée est lue une fois, pas trente fois par seconde.** La relire à la
  cadence du flux coûtait 130 points de processeur pour un contenu qui ne change jamais.
- **Le voile et le vignettage sont calculés une seule fois** dans une image transparente
  superposée, au lieu d'être recalculés par image : 118 % → 49 %.
- **Un seul redimensionnement.** Cadrer puis agrandir pour la dérive en faisait deux.

À l'inverse, deux hypothèses raisonnables se sont révélées fausses à la mesure : couper le
mouvement de fond ne gagne rien, et donner la carte graphique au navigateur non plus — il ne
l'exploite pas dans un écran virtuel.

### Polices

ffmpeg écrit avec les mêmes caractères que l'aperçu : Source Serif 4, extraite de la page
(`stream/scene/scene-font.js`) vers `stream/polices/`, sous licence SIL OFL 1.1. La date,
que ffmpeg ne sait écrire que dans la locale du système, est déposée en français dans un
fichier qu'il relit à chaque image.

### Encodage

L'encodage passe sur la puce vidéo dès qu'il y en a une : NVENC sur une carte NVIDIA, VAAPI
sur une puce Intel ou AMD, libx264 sinon. Chaque profil est **réellement essayé** au démarrage
— une carte visible ne garantit pas que la bibliothèque soit là, et découvrir l'échec en
direct coûterait le flux. Mesuré sur la même source, en temps réel : 96 % d'un cœur en
logiciel contre 20 % sur la carte.

L'accès au matériel est donné automatiquement par `stream/materiel.sh`, qui ajoute le fichier
Docker qui convient à la machine. Sur une machine sans puce vidéo et sous six cœurs, la
définition est ramenée d'elle-même à 1280×720 : le 1080p logiciel n'y décroche pas franchement,
il s'étrangle jusqu'à ce que quelque chose meure. `STREAM_ADAPTER=false` l'en empêche.

Attention : **une machine virtuelle Proxmox ne voit pas la puce vidéo de son hôte.** Sur ce
genre d'installation, l'encodage restera logiciel tant que le projet tournera dans une VM
plutôt que dans un conteneur LXC.

## 6. Pièges rencontrés, et ce qu'il a fallu faire

- **Un navigateur sans affichage n'émet aucun son.** Le conteneur embarque donc un écran
  virtuel (Xvfb) et un serveur audio (PulseAudio) avec un puits virtuel que FFmpeg vient lire.
  C'est l'écueil principal de ce montage.
- **La lecture automatique est bloquée par défaut.** Le navigateur tourne avec cette politique
  désactivée, et la page accepte `?autoplay=1` pour démarrer sans clic.
- **Enregistrer six heures de silence est trop facile.** Le générateur mesure le niveau sur
  15 s avant la vraie capture et refuse de continuer sous -70 dBFS, en disant quoi vérifier.
- **Une variable posée dans l'image Docker écrase la logique du script.** `LOFI_URL` et
  `ECRAN` étaient définies dans le Dockerfile : le script croyait choisir, l'image avait déjà
  décidé. Résultat, la scène n'était pas affichée et le flux était agrandi depuis du 720p.
  Les défauts appartiennent au script, l'image ne fixe que la base.
- **`--window-size` de Chromium veut une virgule**, pas un `x` : avec `1280x720` l'option est
  ignorée sans erreur et la fenêtre laisse des bandes noires dans le flux.
- **La bulle de traduction de Chromium résiste aux drapeaux** et s'affichait en plein cadre.
  Elle se coupe dans les préférences du profil, écrites avant le lancement.
- **Une première mise en route n'est pas un démarrage.** Le premier clic sur « Démarrer »
  construit l'image du diffuseur : 285 Mo, 291 paquets, bien plus que le délai de trois
  minutes calibré pour un simple lancement. Le processus était tué en pleine installation et
  l'interface restait muette. Défaut invisible ici — l'image existait déjà — et découvert sur
  une autre installation. Construction et démarrage sont désormais deux choses distinctes.
- **`docker compose down` sans profil supprime le réseau sans arrêter les services des autres
  profils.** Le conteneur de diffusion survivait en pointant vers un réseau détruit et
  refusait ensuite de démarrer (« network … not found »), définitivement. L'arrêt englobe
  maintenant tous les profils, et le démarrage sait recréer un conteneur dans ce cas.
- **Une vidéo ne s'affiche pas dans une balise image.** La galerie de fonds montrait des
  vignettes cassées dès qu'on y déposait des vidéos.
- **Le découpage en segments laisse un résidu vide** : FFmpeg ouvre un dernier fichier juste
  avant de s'arrêter. Les segments trop courts ou silencieux sont écartés après la capture.

## 7. Twitch depuis le centre de contrôle

Le compte se connecte par **code d'appareil** : l'interface affiche un code, on le saisit sur
`twitch.tv/activate`, c'est fini. Pas d'URL de redirection — la console Twitch refuse
`http://localhost` malgré sa propre documentation, et monter du HTTPS pour une application
locale n'aurait rien apporté.

Le **Client ID est livré avec le projet**. Il n'est pas secret : Twitch le transmet en clair à
chaque requête. Qui clone n'a donc rien à créer, il connecte simplement son propre compte.
Chacun peut y substituer sa propre application depuis l'interface.

Ce que ça donne : **clé de diffusion récupérée automatiquement** (elle n'est jamais affichée,
et ne ressort d'aucune réponse de l'API) · titre et catégorie modifiables · état réel du direct
· spectateurs, abonnés, pic et moyenne · **chat en direct**, lu et envoyé · rediffusions
listées et supprimables.

**Le chat est tenu par le serveur**, jamais par le navigateur : le jeton ne quitte pas la
machine. Tampon borné, reconnexion de 1 s à 30 s puis arrêt explicite — jamais de boucle sans
fin. Le texte des messages n'est jamais interprété comme du HTML : il est écrit par des
inconnus.

**L'historique des spectateurs n'existe pas chez Twitch** : il est échantillonné ici, une fois
par minute et pendant le direct seulement, sur une fenêtre glissante bornée. Une valeur
indisponible ne s'affiche pas — elle n'est jamais remplacée par un zéro.

**L'archivage des rediffusions ne se pilote pas.** L'API Twitch n'expose pas « Store past
broadcasts », ni pour l'activer ni pour le couper : l'interface le dit et renvoie au réglage,
plutôt que de simuler un contrôle inexistant. Le contournement est la suppression automatique,
désactivée par défaut, sous confirmation, et **non rétroactive** — elle n'efface que ce qui
paraît après son activation.

**YouTube n'est encore qu'une destination RTMP.** Tout ce qui précède reste à faire, et ce
n'est pas un copier-coller : voir `TODO.md`.

## 8. Ce qui reste ouvert

- **Le corpus de secours ne fait qu'un fichier de 40 s.** C'est la seule faiblesse réelle du
  montage : si le navigateur tombe, le repli n'a presque rien à jouer. Une à deux heures de
  capture suffisent — en temps réel, une heure de musique coûte une heure.
- **YouTube au même niveau que Twitch** : autorisation Google, obligation de créer une
  diffusion avant que la clé serve, quota de 10 000 unités par jour. Détail dans `TODO.md`.
- **Le renouvellement du jeton Twitch n'a jamais été observé** — écrit d'après la
  documentation, sans secret client. Si le compte se déconnecte, c'est là qu'il faut regarder.
- **La suppression d'une rediffusion n'a pas été exercée** : irréversible, sur un vrai compte.
- Les crédits (`CREDITS.md`) restent à porter dans la description de la chaîne : deux
  attributions dues, aucun remplacement d'échantillon nécessaire.
- 60 images par seconde coûtent le double de processeur pour un fond quasi immobile.
