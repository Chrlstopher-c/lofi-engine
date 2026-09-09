# STATE — LoFi Engine
*Dernière mise à jour : 2026-09-09*

## Résumé de l'état actuel
Générateur de musique lofi procédurale, en production sur https://lofi.christophercouspeyre.com
depuis le Raspberry Pi (service systemd `lofi-engine`, port 8794, derrière le tunnel Cloudflare).
Le dépôt est un fork de meel-hd/lofi-engine sur le compte Chrlstopher-c, mis aux normes Echo et
reproductible : `./start.sh` en local passe par Docker, `./deploy-pi.sh` reconstruit et redéploie
la production en vérifiant la réponse publique. Aucune modification fonctionnelle n'a été
apportée à l'application elle-même.

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
- Clone, analyse et mesure de consommation du projet amont avant tout déploiement.
- Déploiement sur le Pi : service systemd, entrée d'ingress dans le tunnel Cloudflare, création
  du sous-domaine `lofi.christophercouspeyre.com`.
- Fork sur Chrlstopher-c, mise aux normes Echo : scripts start/stop/restart, `deploy-pi.sh`,
  `server.ts`, `.echoforge.yml`, `.env.example` et les quatre fichiers de documentation.
- Passage du lancement local à Docker : image en deux étapes, conteneur publié sur toutes les
  interfaces réseau, scripts recâblés, fonctionnels sur un clone vierge.
- Ajout puis retrait d'une compatibilité `vmdocker` — le binaire n'existe pas (voir plus bas).
- Le message d'erreur d'absence de Docker donne désormais la commande de la distribution
  courante, vérifiée sur six familles.

## Stream 24/7 — construit le 2026-09-09
Diffusion en direct vers Twitch et/ou YouTube, configurée entièrement par le `.env`, entièrement
en conteneurs : rien n'est installé sur la machine hôte. Le moteur génère la musique en continu
dans un navigateur ; si ce navigateur tombe, le corpus enregistré est rejoué **dans le même puits
audio**, si bien que ffmpeg ne s'arrête pas et que la connexion aux plateformes tient. Trou de son
mesuré lors d'une panne provoquée : 3,5 s. Détail et mesures : `docs/STREAM-24-7.md`.

Trois profils : `generateur` (enregistre le corpus), `direct` (mode retenu), `diffusion`
(corpus en boucle, sans navigateur). Licences des échantillons : `CREDITS.md`.

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

## Chantier suivant — stream 24/7
Diffuser la musique en continu sur Twitch et YouTube, avec une image de fond. Conception
complète et auto-suffisante dans **`docs/STREAM-24-7.md`**.

Le point dur : la musique est synthétisée dans le navigateur, il n'existe aucun fichier audio
à diffuser. Et le rendu hors-ligne est inaccessible — le moteur est câblé sur `Tone.Master`,
un nœud global, donc `Tone.Offline` ne peut pas l'atteindre sans refactoriser du code amont.
La capture se fera en temps réel.

Architecture retenue : corpus audio pré-généré, diffusé en boucle par un unique FFmpeg. Tout
passe par des conteneurs Docker — aucun système hôte n'est modifié. Le choix des plateformes et
les clés de diffusion vivent dans le `.env`, désormais ignoré par git (il ne l'était pas, sur un
dépôt public). Bloquants à lever : la licence des échantillons audio n'est pas documentée, et la
machine qui hébergera le diffuseur n'est pas décidée.

## Prochaines étapes
1. Trancher le sort du README (amont conservé, ou charte Echo via le skill `readme`).
2. Si la fréquentation monte : cache navigateur explicite sur les mp3.
3. Éventuellement dockeriser la production — suppose de construire l'image sur le PC et de la
   pousser vers le Pi par un registre. Chantier distinct, non engagé.

## Points en suspens
- Le README n'est pas tranché.
- La production ne passe pas par Docker, contrairement au local — écart assumé et documenté.
