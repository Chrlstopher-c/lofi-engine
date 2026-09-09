# STATE — LoFi Engine
*Dernière mise à jour : 2026-09-09*

## Statut global
En prod — servi sur https://lofi.christophercouspeyre.com depuis le Raspberry Pi.

## Nature du dépôt
Fork de [meel-hd/lofi-engine](https://github.com/meel-hd/lofi-engine) (MIT, Mehdi El Oualy).
L'upstream est déclaré comme remote `upstream` : `git fetch upstream` puis merge pour suivre
les évolutions amont. Les ajouts Echo (scripts, doc, serveur de production) vivent à la racine
et ne touchent pas au code source de l'application.

## Stack
Svelte 3 + TypeScript + Vite pour l'interface · Tone.js pour la synthèse audio procédurale ·
Tauri 2 pour la version desktop · Bun pour le runtime et le serveur statique de production.

## Décisions clés
- 2026-09-09 — Hébergement sur le Pi en site statique plutôt qu'en application Tauri : toute la
  synthèse audio tourne dans le navigateur du visiteur, le serveur ne fait que servir des
  fichiers. Coût mesuré : 28 Mo de RAM sur le Pi, constants quelle que soit la fréquentation.
- 2026-09-09 — Le build ne tourne jamais sur le Pi : mesuré à 1 891 Mo de pic mémoire, contre
  455 Mo disponibles à l'époque sur la machine. On construit sur le PC et on envoie le `dist/`.
- 2026-09-09 — Serveur maison (`server.ts`) plutôt qu'un serveur statique tout fait : les pistes mp3
  sont lues en streaming par le navigateur, qui les demande par tranches (requêtes Range).
- 2026-09-09 — Port local 4707, port de production 8794 sur le Pi.

## Avancées récentes
- 2026-09-09 — Compatibilité `vmdocker` : sous VM la commande remplace `docker`. La détection est
  factorisée dans `docker-cli.sh`, testée sur les trois cas (docker, vmdocker, démon absent).
- 2026-09-09 — Lancement local passé sous Docker : image en deux étapes, conteneur publié sur
  toutes les interfaces réseau. Les scripts start/stop/restart pilotent Docker et fonctionnent
  sur un clone frais, sans rien installer sur l'hôte.
- 2026-09-09 — Déploiement initial sur le Pi, tunnel Cloudflare et sous-domaine `lofi` créés.
- 2026-09-09 — Fork sur le compte Chrlstopher-c, mise aux normes Echo du dépôt.

## Points en suspens
- Le README est celui de l'auteur amont, non retouché — à décider s'il passe à la charte Echo
  (ce qui compliquerait les merges depuis l'upstream).
- Aucune modification fonctionnelle apportée à l'application elle-même pour l'instant.
