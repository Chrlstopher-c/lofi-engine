# Scène du direct

Page affichée plein écran dans le navigateur du conteneur `lofi-direct`, à la place de l'image
fixe. Elle compose un fond, le moteur (qui joue le son), les textes du live et un bloc
d'informations. Aucune dépendance réseau : la police est embarquée, tout le reste est local.

Pensée pour 1280×720 (l'écran Xvfb) ; toutes les tailles sont en `vw`, elle tient donc à
l'identique en 1920×1080.

## Fichiers

| Fichier | Rôle |
|---|---|
| `scene.html` | La page : les couches (HTML) et leur style (CSS). Pas de logique. |
| `scene-config.js` | Lit les paramètres de l'URL, applique les défauts, expose `window.SCENE_CONFIG`. |
| `scene.js` | Applique la configuration, tient l'horloge, lit l'accord courant dans le moteur. |
| `scene-font.js` | Source Serif 4 (licence OFL) en base64, deux graisses. Fichier généré, ne pas éditer. |

Ordre de chargement : `scene-font.js` → `scene-config.js` (dans `<head>`), puis `scene.js` en fin
de `<body>`, une fois les éléments présents.

## Servir la page

La scène doit être **sur la même origine** que le moteur : l'iframe charge `/?autoplay=1` et
`scene.js` lit son DOM, ce qu'une autre origine interdit. Le conteneur `lofi-engine` sert le
dossier `dist/` (build Vite) — `stream/scene/` n'y est pas par défaut. Deux façons de l'exposer :

- copier le dossier dans `public/scene/` avant le build (Vite le recopie tel quel dans `dist/`) ;
- ou le copier dans `dist/scene/` de l'image finale.

La page est alors `http://lofi-engine:4707/scene/scene.html`, à donner en `LOFI_URL`. Les chemins
internes (`scene-*.js`) sont relatifs, l'iframe et le fond par défaut sont absolus (`/…`) : le
dossier peut vivre à n'importe quel sous-chemin de l'origine.

## Paramètres d'URL

Tous facultatifs. Un paramètre texte vide (`&credits=`) masque son bloc.

| Paramètre | Défaut | Rôle |
|---|---|---|
| `titre` | `LoFi Engine` | Titre du live. |
| `sousTitre` | `Musique lofi générée en direct, note par note` | Ligne sous le titre. |
| `credits` | Attribution CC BY de `CREDITS.md` (piano, vent) | Ligne discrète sous le sous-titre. |
| `fond` | `/assets/background/bg9.webp` | URL de l'image de fond, en `cover` (dix fonds dans `/assets/background/`). |
| `horloge` | `true` | Heure `HH:MM` et date, en haut à droite (`fr-FR`, fuseau du conteneur). |
| `accords` | `true` | Tonalité et progression d'accords, en bas à droite, lues dans le moteur. |
| `theme` | `nuit` | `nuit` (neutre), `ambre` (chaud), `brume` (froid) : teinte du voile et couleur d'accent. |
| `moteur` | `false` | Rend le moteur visible, pour contrôler qu'il tourne. Il est toujours chargé. |
| `mouvement` | `true` | Dérive très lente du fond (120 s par aller). `false` pour un fond immobile. |

Booléens : `1`/`true`/`oui`/`on` et `0`/`false`/`non`/`off`. Une valeur inconnue → défaut.

Exemple :

```
/scene/scene.html?titre=Nuit%20blanche&sousTitre=lofi%20pour%20travailler&theme=ambre&fond=/assets/background/bg1.webp
```

## Ce qui est affiché est réel

Rien n'est codé en dur ni simulé. L'heure vient de l'horloge du conteneur. La tonalité et
l'accord actif sont lus toutes les 300 ms dans le DOM du moteur (`ol.progressionList`, `li.key`,
`li.live`) ; le moteur affiche le degré en chiffre (1–7), la scène le transcrit en chiffre romain.
Si la lecture échoue (moteur pas encore prêt, iframe rechargée, origine différente), le bloc est
masqué — jamais remplacé par une valeur de repli.

## Tenue dans le temps

La page tourne des semaines sans rechargement :

- deux minuteries fixes (`setInterval`), créées une seule fois au démarrage ;
- le DOM n'est écrit que si la valeur change (comparaison de texte ou de signature) ;
- une seule animation CSS, sur une couche composée (`transform`), désactivable (`mouvement=0`) ;
- pas de `backdrop-filter` : le navigateur du conteneur tourne sans GPU.

## Ajouter une couche

1. Dans `scene.html`, ajouter un élément avec la classe `couche` et une classe propre, à la
   place voulue dans l'empilement (`z-index` de 0 à 4 aujourd'hui : fond, voile, moteur, texte,
   info). Une couche couvre l'écran et ne capte pas la souris ; ses enfants se positionnent en
   absolu.
2. Si elle dépend d'un paramètre, le déclarer dans `DEFAUTS` de `scene-config.js` et le lire
   avec `lireTexte` / `lireBooleen` dans `lire()`.
3. Si elle a une logique, l'écrire dans `scene.js` comme une fonction `demarrerXxx()` appelée
   dans le bloc « Démarrage » — une minuterie au plus, jamais de création répétée, écriture DOM
   seulement sur changement. Si la donnée n'est pas disponible, masquer (`hidden`), ne pas
   inventer.
4. Ne jamais mettre l'iframe `#moteur` en `display: none` : cela peut suspendre l'audio.
