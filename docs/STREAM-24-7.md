# Stream 24/7 — LoFi Engine vers Twitch et YouTube

*Conçu et construit le 2026-09-09. La chaîne complète a été mesurée de bout en bout ;
ce qui reste ouvert est listé au §7.*

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
cp .env.example .env      # puis y mettre les clés de diffusion

# 1. Enregistrer un corpus de secours (temps réel : CAPTURE_DUREE en secondes)
docker compose --profile generateur run --rm -e CAPTURE_DUREE=3600 generateur

# 2. Déposer l'image de fond dans corpus/, et la nommer dans STREAM_IMAGE

# 3. Diffuser en direct
docker compose --profile direct up -d
docker compose --profile direct logs -f direct
```

Aucun profil ne démarre avec le site : `docker compose up -d` ne lance que la page.

## 4. Ce qui a été mesuré

Toutes ces valeurs viennent d'un flux réellement reçu sur un serveur RTMP local, pas d'une
lecture de configuration.

| Vérification | Résultat |
|---|---|
| Capture d'une minute | 60,0 s de FLAC à **-24,4 dBFS** (crête -4,2 dB, aucun écrêtage) |
| Flux du mode direct | H.264 1280×720 à 30 i/s · AAC 44,1 kHz stéréo · son à **-24,5 dBFS** |
| Intervalle entre images-clés | **2,00 s**, la limite que Twitch impose |
| **Navigateur tué en pleine diffusion** | le flux **n'a pas été coupé** ; trou de son de **3,5 s** avant la reprise par le corpus, puis retour automatique à la génération |
| Reconnexion après coupure réseau | relance automatique, vérifiée en coupant le serveur RTMP |
| Refus si aucune plateforme activée | code 1, message nommant les variables à mettre |
| Refus si une clé manque | code 1, la clé manquante nommée, avec où la trouver |

Poids du corpus : **environ 400 Mo par heure** en FLAC, sans perte — il n'est encodé qu'une
fois, à la diffusion.

**Sur la détection de panne.** Une première version contrôlait l'état du moteur toutes les
30 s : le trou de son mesuré était alors de **32 s**. La surveillance a été séparée en deux
vitesses — la mort du navigateur est vue en 2 s, la mesure de niveau (qui coûte plusieurs
secondes d'écoute) reste espacée. C'est ce qui ramène le trou à 3,5 s.

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
