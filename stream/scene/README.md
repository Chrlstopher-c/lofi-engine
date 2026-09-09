# Scène du direct

Page affichée plein écran dans le navigateur du conteneur `lofi-direct`, à la place de l'image
fixe. Elle compose un fond, le moteur (qui joue le son) et des **calques** décrits dans un fichier
de scène, relu à chaud. Aucune dépendance réseau : la police est embarquée, tout le reste est local.

Pensée pour 1280×720 (l'écran Xvfb) ; toutes les tailles sont en `vw`/`vh`, elle tient donc à
l'identique en 1920×1080.

## Fichiers

| Fichier | Rôle |
|---|---|
| `scene.html` | La page : les couches fixes (fond, voile, moteur, conteneur des calques) et tout le style. Pas de logique. |
| `scene-config.js` | Modèle de données : défauts embarqués, assainissement d'un JSON reçu, surcharges d'URL. |
| `scene-calques.js` | Registre des types de calque : comment créer et mettre à jour l'élément de chaque type. |
| `scene.js` | Rechargement à chaud, réconciliation des calques, horloge, lecture des accords dans le moteur. |
| `scene-font.js` | Source Serif 4 (licence OFL) en base64, deux graisses. Fichier généré, ne pas éditer. |

Ordre de chargement : `scene-font.js` → `scene-config.js` → `scene-calques.js` (dans `<head>`),
puis `scene.js` en fin de `<body>`, une fois les éléments présents.

## Servir la page

La scène doit être **sur la même origine** que le moteur : l'iframe charge `/?autoplay=1` et
`scene.js` lit son DOM, ce qu'une autre origine interdit. `docker-compose.yml` monte ce dossier
dans `dist/scene/` et le dossier `corpus/` dans `dist/fonds/` du conteneur du site. La page est
alors `http://lofi-engine:4707/scene/scene.html` ; le fichier de scène et les images sont sous
`/fonds/`.

## Le fichier de scène : `/fonds/scene.json`

Écrit par le centre de contrôle (`stream/controle/`), dans le dossier `corpus/`. Le modèle de
référence avec ses valeurs par défaut est `stream/controle/scene-defaut.json` ; `scene-config.js`
en embarque une copie, c'est ce qui s'affiche tant qu'aucun fichier n'a été lu.

```
Scene
  version      1
  theme        "nuit" | "ambre" | "brume"      teinte du voile, couleur d'accent, couleur de texte
  fond
    fichier    nom de fichier sous /fonds/ ; vide = pas d'image, seulement la teinte du thème
    ajustement "cover" | "contain"
    mouvement  dérive très lente du fond (120 s par aller)
    voile      0 à 1, force de l'assombrissement vers le bas
    vignettage assombrissement des bords
  calques[]    l'ordre du tableau est l'ordre d'empilement, le dernier au-dessus
```

Un calque :

| Champ | Rôle |
|---|---|
| `id`, `nom` | Identifiant stable (réconciliation à chaud) et nom d'affichage dans le centre de contrôle. |
| `type` | `texte`, `horloge`, `accords` ou `image`. |
| `visible` | `false` retire le calque de la page. |
| `ancre` | `haut-gauche`, `haut-centre`, `haut-droite`, `centre`, `bas-gauche`, `bas-centre`, `bas-droite`. |
| `x`, `y` | Décalage depuis l'ancre, en % de la largeur (`vw`) et de la hauteur (`vh`). Pour les ancres centrées, décalage depuis le centre. |
| `taille` | En % de la largeur : taille de police pour `texte`, `horloge`, `accords` ; largeur pour `image`. |
| `opacite` | 0 à 1. |
| `couleur` | `#rrggbb`. Sans couleur, celle du thème. |
| `texte`, `graisse` | Type `texte`. `legere` = police titre en 300, `normale` = police texte en 400. Les sauts de ligne sont respectés. |
| `date` | Type `horloge` : afficher la date sous l'heure. |
| `cadre` | Type `accords` : dessiner la carte translucide. |
| `fichier` | Type `image` : nom de fichier, chargé depuis `/fonds/<fichier>`. |

Tout ce qui arrive du fichier est assaini (`nettoyerScene`, même règles que le centre de
contrôle) : type inconnu → calque ignoré, nombre hors bornes → borné, nom de fichier avec un
chemin → vidé, plus de 40 calques → tronqué. Le résultat est toujours une scène complète.

## Rendu dynamique

Le HTML ne contient aucun calque : `#calques` est vide au chargement. `scene.js` construit
les éléments depuis le tableau et les **réconcilie par `id`** à chaque application :

- un `id` nouveau → élément créé par `scene-calques.js` (`creer`) ;
- un `id` connu dont le calque a changé (comparaison de la sérialisation JSON) → élément mis à
  jour en place (`appliquer`) ; inchangé → rien n'est touché ;
- un `id` disparu ou passé `visible: false` → élément retiré ;
- l'ordre du DOM est aligné sur l'ordre du tableau, en ne déplaçant que ce qui n'est pas à sa place.

Un calque `texte` ajouté depuis le centre de contrôle s'affiche donc sans rien prévoir pour lui.
Le placement est commun à tous les types : l'ancre devient `top`/`bottom`/`left`/`right` (plus un
`translate` pour les ancres centrées), la couleur devient une variable `--c` que le CSS décline
en opacités, la taille devient `font-size` (ou `width` pour une image), le tout composé en `em`
pour que l'horloge et la carte d'accords suivent leur `taille`.

## Rechargement à chaud

`scene.js` relit `/fonds/scene.json` toutes les 3 s (`fetch` sans cache, délai de 2,5 s, jamais
deux lectures en parallèle). Le texte reçu est comparé au dernier texte appliqué : identique →
rien ne se passe. Différent → parsé, assaini, surchargé par l'URL, appliqué par réconciliation.
Pas de rechargement de page, pas d'élément recréé pour rien ; un changement d'image de fond est
préchargé avant d'être posé, pour ne jamais montrer de trou noir entre deux fonds.

Cas dégradés, tous silencieux à l'écran :

- fichier absent (404), serveur injoignable, délai dépassé → la dernière scène valide reste ;
- JSON invalide → ignoré, la dernière scène valide reste ; la lecture suivante retente ;
- JSON valide mais contenu aberrant → assaini champ par champ, jamais rejeté en bloc ;
- au démarrage, avant la première lecture réussie → les défauts embarqués ;
- image de fond ou d'un calque `image` introuvable → le fond reste ce qu'il était, l'image est
  masquée (jamais l'icône d'image cassée).

Aucune erreur n'est écrite dans la page : elle est diffusée.

## Paramètres d'URL

Tous facultatifs, pour tester une variante sans toucher au fichier. Un paramètre **présent et
non vide** l'emporte sur le fichier ; absent ou vide, le fichier prime. Ils sont réappliqués à
chaque rechargement à chaud.

| Paramètre | Rôle |
|---|---|
| `titre`, `sousTitre`, `credits` | Texte des calques `titre`, `sous-titre`, `credits`. Si le calque n'existe pas dans le fichier, il est créé en bas à gauche. |
| `fond` | Nom de fichier sous `/fonds/`, ou chemin absolu de la même origine (`/assets/background/bg1.webp`). |
| `ajustement`, `mouvement`, `voile`, `vignettage` | Les champs du fond. |
| `horloge`, `accords` | Visibilité de tous les calques de ce type. |
| `theme` | `nuit`, `ambre`, `brume`. |
| `calque.<id>.<champ>` | N'importe quel champ d'un calque existant : `calque.titre.couleur=%23ff0000`, `calque.horloge.visible=0`. |
| `scene` | Un autre fichier de scène, même origine : `scene=/fonds/scene-test.json`. |
| `moteur` | `1` rend le moteur visible, pour contrôler qu'il tourne. Il est toujours chargé. |

Booléens : `1`/`true`/`oui`/`on` et `0`/`false`/`non`/`off`. Une valeur inconnue → valeur du fichier.

## Ce qui est affiché est réel

Rien n'est codé en dur ni simulé. L'heure vient de l'horloge du conteneur. La tonalité et
l'accord actif sont lus toutes les 300 ms dans le DOM du moteur (`ol.progressionList`, `li.key`,
`li.live`) ; le moteur affiche le degré en chiffre (1–7), la scène le transcrit en chiffre romain.
Si la lecture échoue (moteur pas encore prêt, iframe rechargée, origine différente), chaque calque
`accords` est masqué — jamais remplacé par une valeur de repli.

## Tenue dans le temps

La page tourne des semaines sans rechargement :

- trois minuteries fixes (`setInterval` : scène, horloge, accords), créées une seule fois ;
- le DOM n'est écrit que si la valeur change (texte, signature de calque, signature de progression) ;
- les éléments retirés sont oubliés de la table de réconciliation, bornée à 40 calques ;
- une seule animation CSS, sur une couche composée (`transform`), désactivable (`mouvement`) ;
- pas de `backdrop-filter` : le navigateur du conteneur tourne sans GPU ;
- l'iframe `#moteur` n'est jamais en `display: none` : cela peut suspendre l'audio.

## Ajouter un type de calque

1. Dans `scene-calques.js`, ajouter une entrée à `TYPES` avec deux fonctions : `creer()` rend
   l'élément (structure interne comprise), `appliquer(el, calque)` y reporte les champs du calque.
   Le placement, la couleur, l'opacité et la taille sont déjà faits par `styler` — ne pas les
   refaire. Une donnée indisponible → `el.hidden = true`, jamais une valeur inventée.
2. Dans `scene-config.js`, ajouter le nom du type à `TYPES` et, s'il a des champs propres, les
   assainir dans `nettoyerCalque` (bornes, longueur, jeu de caractères).
3. Dans `scene.html`, écrire le style sous `.calque-<type>`, composé en `em` pour suivre `taille`
   et en `rgb(var(--c) / …)` pour suivre `couleur`.
4. Si le type a une donnée vivante (comme l'heure ou les accords), l'alimenter dans `scene.js`
   par une minuterie unique qui parcourt `.calque-<type>` — jamais une minuterie par élément.
5. Ajouter le type au modèle du centre de contrôle (`stream/controle/types.ts` et `scene.ts`),
   sinon il sera rejeté à l'enregistrement.
