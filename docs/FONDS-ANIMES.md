# Fonds animés — où en trouver, et lesquels ne posent pas de problème

*Établi le 2026-09-09, pour la diffusion 24/7. Les fonds se déposent dans le centre de
contrôle, onglet Scène.*

Une diffusion permanente n'a pas le même risque qu'une vidéo. Un fond qui passe des mois à
l'antenne finit par être vu, comparé, signalé. D'où ce document : les sources, mais surtout
ce qui les distingue.

---


## Depuis le centre de contrôle

L'onglet **Pixabay** cherche images et vidéos sans quitter l'interface, et dépose ce qu'on
retient dans le corpus — c'est-à-dire dans l'explorateur de la composition, où le fichier
apparaît aussitôt.

Il demande une clé d'API, gratuite : créer un compte sur Pixabay, puis ouvrir
[la documentation de l'API](https://pixabay.com/api/docs/) **en étant connecté** — la clé
s'affiche au début de la page, elle n'a pas d'écran à elle. Le mode d'emploi est repris dans
l'onglet. Elle est écrite dans le `.env`, qui n'est pas versionné, et n'est jamais réaffichée.

Deux gestes distincts sur chaque résultat :

- **l'étoile** le garde de côté sans rien télécharger — un fond pèse jusqu'à quelques dizaines
  de mégaoctets, et on en repère plus qu'on n'en garde ;
- **Télécharger** le rapatrie dans le corpus, avec sa provenance dans `corpus/fonds-sources.json`.

Un média déjà pris est marqué comme tel : inutile de s'en souvenir.

## 1. Sans attribution, usage commercial — les plus sûres

| Source | Licence | Ce qu'elle vaut |
|---|---|---|
| [Pixabay — vidéos](https://pixabay.com/videos/) | Content License | Aucun crédit exigé, usage commercial autorisé. Le plus gros fonds : plusieurs milliers de boucles sur les mots-clés lofi. |
| [Pexels — vidéos](https://www.pexels.com/videos/) | Pexels License | Mêmes conditions. Catalogue plus photographique, moins d'animation. |
| [Mixkit](https://mixkit.co/free-stock-video/lo-fi/) | Mixkit License | Aucun crédit, sans filigrane. Catalogue plus petit mais trié : la page « lo-fi » est directement exploitable. |
| [Coverr](https://coverr.co/) | Coverr License | Boucles pensées pour l'arrière-plan, donc bouclées proprement. |
| [Kenney](https://kenney.nl/assets) | **CC0** | Domaine public sans réserve. Pixel art, plutôt éléments que scènes complètes. |
| [OpenGameArt — CC0](https://opengameart.org/content/cc0-resources) | **CC0** | Filtrable par licence. Vérifier la licence *de chaque* fichier : le site en héberge plusieurs. |
| [itch.io — étiquette CC0](https://itch.io/game-assets/tag-cc0) | **CC0** | Scènes pixel art animées. Auteurs à connaître : Ansimuz, Pixel Frog, 0x72. |
| [Internet Archive](https://archive.org/details/movies) | variable | Domaine public réel pour les fonds anciens. La licence est indiquée par élément, jamais globale. |

**Attention à Vecteezy et Videvo** : catalogues mixtes, où le gratuit exige souvent une
attribution et où le reste est payant. La licence se lit fichier par fichier.

## 2. Ce qui rend bien pour du lofi

Termes qui donnent des résultats exploitables, sur Pixabay et Pexels :

`lofi background` · `lofi animation` · `looping lofi` · `rain window` · `rain on glass` ·
`night city drive` · `neon city rain` · `cozy room` · `pixel art loop` · `anime style loop` ·
`cassette tape` · `vinyl record spinning` · `bokeh lights` · `slow clouds timelapse` ·
`fireplace loop` · `train window` · `aquarium` · `lava lamp` · `retro vhs overlay`

Les registres qui fonctionnent : pluie derrière une vitre · ville de nuit vue de haut ·
intérieur chaud avec une lampe · pixel art animé · abstrait très lent (fumée, encre, bokeh).

## 3. Ce qui convient techniquement

- **MP4 (H.264) ou WebM.** Le GIF passe par le type de calque *Image*, il s'anime seul —
  mais il est lourd et limité à 256 couleurs : préférer une vidéo dès que possible.
- **Boucle franche** : la dernière image doit enchaîner sur la première sans saut. Beaucoup
  de « loops » de stock n'en sont pas. À vérifier avant de partir pour des semaines.
- **10 à 60 secondes suffisent.** Plus long ne se remarque pas, et pèse pour rien.
- **1080p au maximum** : le flux sort en 1080p, au-delà c'est du poids perdu.
- **Le son est coupé de force** par la scène — inutile de chercher des fichiers muets.

## 4. Les pièges, et ils sont réels

**Du contenu volé circule sur les plateformes gratuites.** Des œuvres protégées y sont
déposées par des tiers, et la licence affichée n'engage que le déposant. Le risque est faible
mais il ne tombe jamais à zéro. Deux réflexes : se méfier de ce qui ressemble à une œuvre
connue (extrait d'anime, image de jeu vidéo, plan de film), et garder trace de la page de
téléchargement de chaque fond utilisé — c'est ce qui permet de répondre à une réclamation.

**Les marques et logos reconnaissables** sortent du cadre de la licence Pixabay dès qu'il y a
usage commercial. Une enseigne dans un plan de ville nocturne suffit à poser question sur une
chaîne monétisée.

**Une réclamation peut être fausse et faire mal quand même.** En juillet 2022, les deux
directs de Lofi Girl ont été coupés par une réclamation abusive, alors que la chaîne détenait
tous les droits sur sa musique. Ils ont été rétablis, mais après coup. Aucune licence ne
protège d'un signalement injustifié — seule la capacité à prouver l'origine permet de le
faire lever vite.

**Ce qui est déjà réglé de notre côté** : la musique est générée note par note, aucune
composition tierce n'est diffusée. C'est ce qui fait tomber la plupart des chaînes musicales.
Le fond animé est donc le seul point d'exposition qui reste.

## 5. Ne pas reproduire l'esthétique Lofi Girl

Le personnage à la fenêtre et son identité visuelle appartiennent à Lofi Girl (ex-ChilledCow).
S'en approcher volontairement expose à une réclamation fondée, cette fois. Le registre lofi
est libre ; ce personnage précis ne l'est pas.

---

*Vérification : les licences ci-dessus ont été lues à leur source. Les pages de recherche des
plateformes n'ont pas pu être ouvertes depuis cette machine (blocage anti-robot) — leur
existence et leur volume viennent des résultats de recherche, pas d'une consultation directe.*
