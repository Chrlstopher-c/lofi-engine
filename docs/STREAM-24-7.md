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

## 5. La scène affichée à l'écran

Ce qui est diffusé n'est pas une image fixe mais une **page web** rendue par le navigateur qui
tourne déjà dans le conteneur, et capturée à l'écran. Le choix est délibéré : composer en
couches CSS s'ajuste en éditant du HTML, là où un montage en filtres FFmpeg se réécrit
entièrement à chaque retouche.

Les couches, du fond vers l'avant : l'image de fond (légère dérive lente, voile et vignettage
pour la lisibilité) · le moteur en iframe, invisible mais **actif — c'est lui qui joue** · les
textes (titre, sous-titre, crédits) · les informations (horloge, tonalité et accord en cours,
lus en direct dans le DOM du moteur).

Tout se règle dans le `.env` : `STREAM_TITRE`, `STREAM_SOUS_TITRE`, `STREAM_CREDITS`,
`STREAM_FOND`, `STREAM_HORLOGE`, `STREAM_ACCORDS`, `STREAM_THEME`. `STREAM_SCENE=false`
revient à l'image fixe. Détail des paramètres : `stream/scene/README.md`.

La scène est montée dans le conteneur du site, pas copiée dans l'image : elle se retouche
sans reconstruire quoi que ce soit, et surtout elle est servie **depuis la même origine** que
le moteur — sans quoi l'iframe qui produit le son serait bridée.

Vérifié sur le flux reçu : le son sort bien d'une iframe à opacité nulle (-24,9 dBFS), la
scène est rendue en 1920×1080 réels, et l'accord affiché suit la progression du moteur.

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

## 7. Ce qui reste ouvert

- **Sur quelle machine tourne le diffuseur.** Il faut Docker et une machine allumée en
  permanence. Le générateur peut tourner ailleurs et le corpus être transféré.
- **L'image de fond** — c'est l'identité de la chaîne. `corpus/fond-test.png` n'est qu'une
  mire de validation.
- **YouTube** exige d'activer le direct sur la chaîne, avec 24 h de délai la première fois.
- Une seule chaîne ou deux · fond fixe ou animé · afficher ou non le nom du morceau.

Les licences des échantillons sont traitées dans `CREDITS.md` : deux crédits à porter en
description de chaîne, aucun remplacement nécessaire.
