# Stream 24/7 — LoFi Engine vers Twitch et YouTube

*Document de conception — rédigé le 2026-09-09, avant implémentation.*
*Objectif : diffuser en continu la musique du moteur, avec une image de fond, sur Twitch et/ou
YouTube — le choix des plateformes et leurs identifiants se règlent dans le `.env`.*

---

## 1. Le point dur, en une phrase

**La musique n'existe pas côté serveur.** Elle est synthétisée en direct dans le navigateur par
Tone.js (Web Audio). Il n'y a aucun fichier audio à diffuser : il faut d'abord faire exister ce
son quelque part, puis l'encoder vers les plateformes.

Tout le reste de la conception découle de ça.

## 2. Ce qui a été vérifié avant d'écrire ce document

| Fait | Conséquence |
|---|---|
| Le moteur route tout vers `Tone.Master` — nœud global créé au chargement des modules (`.chain(vol, Tone.Master)` dans Kick.ts, Piano.ts…) | **Le rendu hors-ligne est inaccessible.** `Tone.Offline` exige que les instruments se connectent à un contexte offline ; ici ils sont câblés en dur sur le contexte global. Y accéder demanderait de refactoriser du code amont, ce qui casse les merges. **La capture se fera en temps réel : une heure de musique coûte une heure.** |
| `.env` n'était **pas** ignoré par git, sur un dépôt **public** | Corrigé le 2026-09-09 : `.env`, `.env.local` et `.env.*.local` ajoutés au `.gitignore`, vérifié en créant un vrai fichier. Sans ça, la première clé de diffusion écrite partait sur GitHub. |
| Aucune attribution de licence pour les échantillons audio dans le dépôt | Point à lever avant toute diffusion publique — voir §6. |

## 3. Les deux architectures possibles

### Voie A — Navigateur en direct → encodeur → RTMP

Un navigateur tourne en permanence sur la page, son audio part dans un puits audio virtuel,
FFmpeg le capture et pousse vers les plateformes.

- **Pour** : musique réellement infinie, jamais deux fois la même, aucun refactor.
- **Contre** : un navigateur qui doit tenir des semaines sans surveillance. Serveur graphique
  virtuel, contournement de la politique de lecture automatique, timers d'arrière-plan bridés,
  fuites mémoire à surveiller. Environ 1 Go de mémoire pour la chaîne complète, en permanence.

### Voie B — Corpus pré-généré → FFmpeg en boucle → RTMP *(retenue)*

On capture une fois plusieurs heures de musique dans des fichiers, puis un FFmpeg seul lit ce
corpus en boucle avec une image de fond et diffuse.

- **Pour** : la diffusion est un unique FFmpeg (~150-250 Mo), sans navigateur ni serveur
  graphique. Increvable, redémarre en deux secondes, tient sur une petite machine.
- **Contre** : la capture coûte du temps réel, et un corpus trop court finirait par s'entendre.
- **Réponse au contre** : générer 12 à 24 h de corpus, mélanger l'ordre de lecture à chaque
  boucle, enrichir par lots au fil du temps. À l'oreille, un corpus de cette taille mélangé est
  indiscernable d'une génération continue.

### Décision

**Voie B.** Un stream 24/7 doit survivre sans surveillance : FFmpeg lisant des fichiers y
arrive, un navigateur tournant trois semaines est un pari. La voie A reste une évolution
possible une fois le stream stable.

## 4. Tout passe par Docker — aucun système hôte n'est modifié

Le projet est déjà dockerisé pour le site. Le stream suit la même règle : **rien ne s'installe
sur la machine hôte**, ni FFmpeg, ni navigateur, ni serveur audio. Deux conteneurs, déclarés
dans le `docker-compose.yml` existant sous des profils distincts pour ne pas démarrer avec le
site :

| Conteneur | Quand il tourne | Ce qu'il contient | Coût |
|---|---|---|---|
| **générateur** | ponctuellement, le temps de produire un corpus | navigateur + capture audio | ~1 Go de mémoire pendant la capture |
| **diffuseur** | en permanence | FFmpeg seul | ~150-250 Mo |

Les deux partagent un volume : le générateur y écrit les pistes, le diffuseur les lit. L'image
de fond y est déposée de la même façon.

**La machine qui héberge ces conteneurs reste à choisir** — n'importe quel hôte doté de Docker
convient, la seule exigence est qu'il soit allumé en permanence pour le diffuseur. Décision de
Chris, pas de cette conception. Le générateur peut tourner ailleurs, ponctuellement, et le
corpus être transféré.

## 5. Configuration — tout dans le `.env`

Le choix des plateformes et leurs identifiants se règlent par variables, sans toucher au code
ni au compose. Les clés ne quittent jamais la machine : `.env` est ignoré par git.

```
# Activer l'une, l'autre, ou les deux
STREAM_TWITCH=true
STREAM_YOUTUBE=false

# Clés de diffusion (à récupérer dans le tableau de bord de chaque plateforme)
TWITCH_STREAM_KEY=
YOUTUBE_STREAM_KEY=

# Serveurs d'ingestion — valeurs par défaut, à changer seulement si besoin
TWITCH_INGEST=rtmp://live.twitch.tv/app
YOUTUBE_INGEST=rtmp://a.rtmp.youtube.com/live2

# Rendu
STREAM_IMAGE=fond.png
STREAM_RESOLUTION=1920x1080
STREAM_FPS=30
STREAM_VIDEO_BITRATE=1500k
STREAM_AUDIO_BITRATE=160k
```

Comportement attendu : une seule plateforme activée → une sortie ; les deux activées → **une
seule passe d'encodage dédoublée vers les deux destinations**, pas deux FFmpeg encodant la même
chose. Aucune plateforme activée, ou clé manquante alors que la plateforme est activée → le
script refuse de démarrer en disant précisément ce qui manque, plutôt que de diffuser dans le
vide.

## 6. Contraintes techniques du flux

- **Vidéo** : image fixe en entrée, 1080p à 30 images/s en sortie. Une image qui ne bouge pas
  coûte très peu de débit. Point non négociable : **intervalle entre images-clés de 2 secondes**
  — Twitch refuse au-delà.
- **Audio** : le corpus lu en boucle, AAC 160 kbps. C'est le seul contenu réel du flux.
- **Robustesse** : redémarrage automatique du conteneur, et reprise du flux après coupure
  réseau sans intervention.

## 7. Ce qui bloque, et qu'il faut lever avant de diffuser

**La licence des échantillons audio.** Le dépôt est sous MIT, mais cette licence couvre le
**code** — aucune attribution n'accompagne les fichiers audio. Les noms portent la signature de
deux sources : le format `nom-123456.mp3` (`city-ambience-9272`, `urban-seagulls-30068`,
`small-waves-onto-the-sand-143040`) est celui de Pixabay, dont la licence est très permissive ;
`Wind-Mark_DiAngelo-1940285615.mp3` porte un nom d'auteur, forme habituelle de SoundBible, où
l'attribution est souvent exigée. S'y ajoutent 48 échantillons de piano dont l'origine n'est pas
documentée.

Une app personnelle et une diffusion publique permanente ne sont pas le même usage. À faire
avant le premier direct : retrouver l'origine de chaque échantillon, et soit créditer, soit
remplacer ce qui ne peut pas l'être. La plupart de ces sources sont permissives — c'est une
vérification, pas une alerte.

**Un avantage réel** : la musique elle-même est générée, donc aucune composition tierce n'est
diffusée. C'est ce qui met en difficulté la plupart des chaînes musicales. Seuls les
enregistrements d'ambiance sont des œuvres tierces.

**L'image de fond** n'existe pas encore, et sa licence sera à vérifier de la même façon.

**Les comptes** : YouTube exige d'activer le direct sur la chaîne, avec 24 h de délai la
première fois. À anticiper.

## 8. Plan d'exécution

1. **Lever la question des licences** (§7) — en premier, parce que le résultat peut imposer de
   remplacer des échantillons, donc de regénérer le corpus.
2. **Choisir l'image de fond** — décision de Chris, c'est l'identité de la chaîne.
3. **Construire le conteneur générateur** : lancer la page, laisser jouer, écrire des pistes
   audio exploitables. Vérifier à l'oreille sur un premier lot court avant une longue capture.
4. **Générer un premier corpus** de quelques heures, mesurer son poids.
5. **Construire le conteneur diffuseur** : lecture du `.env`, refus explicite si une clé
   manque, sortie simple ou dédoublée selon les plateformes activées.
6. **Essai en privé** : diffuser d'abord sur une chaîne non listée pour vérifier image, son,
   stabilité du débit et absence de coupure.
7. **Passer en public**, puis surveiller les premières 24 h.
8. **Enrichir le corpus** par lots successifs.

## 9. Ce qui reste à décider par Chris

- Sur quelle machine tourne le diffuseur (allumée en permanence).
- Une seule chaîne ou deux (Twitch et YouTube ont des publics et des règles différentes).
- Image de fond fixe, ou légèrement animée — une boucle vidéo coûte plus de débit mais rend la
  chaîne moins morte.
- Faut-il afficher quelque chose à l'écran : nom du morceau, horloge, message ?
- Sous quel nom la chaîne existe (identité Echo, ou séparée).

---

## Ce qu'il faut savoir pour reprendre ce chantier sans contexte

- La musique est synthétisée **dans le navigateur** ; il n'existe aucun fichier audio à diffuser.
- Le rendu hors-ligne est **impossible sans refactor** : le moteur est câblé sur `Tone.Master`.
  La capture est donc en temps réel.
- **Tout passe par Docker**, aucun système hôte n'est modifié — c'est une exigence, pas un choix
  de confort.
- **Le choix des plateformes et les clés vivent dans le `.env`**, désormais ignoré par git.
- La licence des échantillons audio **n'a pas été vérifiée** et bloque la diffusion publique.
- La machine qui hébergera le diffuseur **n'est pas décidée**.
