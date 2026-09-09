# Architecture — LoFi Engine
*Dernière mise à jour : 2026-09-09*

## Ce que fait l'application

Un générateur de musique lofi qui compose en direct dans le navigateur. Rien n'est
pré-enregistré côté musique : Tone.js synthétise la batterie, les accords et la basse à la
volée. Les ambiances (pluie, ville, vagues, feu) sont, elles, de vrais enregistrements mélangés
par-dessus. Le visiteur règle l'ambiance ; l'application fait le reste.

## Où tourne le calcul

**Entièrement chez le visiteur.** Le serveur ne fait que livrer des fichiers — il ne synthétise
rien, ne transcode rien, ne garde aucun état. C'est ce qui rend l'hébergement sur un Raspberry
Pi tenable : 28 Mo de mémoire, constants, que la page soit ouverte par une personne ou par
cinquante.

## Découpage des dossiers

| Dossier | Rôle | Qui l'a écrit |
|---|---|---|
| `src/` | L'application Svelte : interface, moteur audio, traductions | Amont |
| `src-tauri/` | La coquille desktop (Linux, macOS, Windows) | Amont |
| `public/` | Les échantillons audio et les fonds d'écran, copiés tels quels dans le site | Amont |
| `scripts/` | Optimisation des images de fond | Amont |
| `dist/` | Le site construit par Vite — jamais versionné, produit par le build | Généré |
| `logs/` | Sortie du serveur local, remise à zéro à chaque lancement | Généré |

Les fichiers ajoutés par Echo vivent tous à la racine (`server.ts`, les scripts `.sh`, cette
documentation, `.echoforge.yml`). Ce cloisonnement est délibéré : il permet de récupérer les
évolutions de l'amont par un simple merge, sans conflit sur le code de l'application.

## Le serveur de production

`server.ts` sert le contenu de `dist/`. Deux points le distinguent d'un serveur statique
ordinaire :

- **Il honore les requêtes Range.** Un navigateur qui lit un mp3 ne le télécharge pas d'un bloc,
  il en réclame des tranches. Sans cette gestion, la lecture audio se comporte mal.
- **Il refuse toute remontée hors de sa racine.** Un chemin qui sortirait du dossier servi est
  rejeté avant même d'ouvrir le fichier.

Il écoute sur `127.0.0.1` par défaut — jamais exposé directement, toujours derrière le tunnel
Cloudflare.

## Comment on le lance

En local, tout passe par **Docker** : `./start.sh` construit l'image et démarre le conteneur.
Rien n'est requis sur la machine hôte à part Docker lui-même — ni Bun, ni Node, ni les
dépendances. Un clone frais suffit.

L'image est construite en deux étapes. La première installe les dépendances et fait tourner
Vite ; la seconde ne garde que le serveur et le site construit. Les outils de build ne se
retrouvent pas dans l'image finale.

Les scripts vérifient que le démon Docker répond avant de s'en servir : un binaire présent ne
prouve rien. Quand rien ne convient, ils s'arrêtent en affichant la commande d'installation de
la distribution courante — sur Debian le paquet s'appelle `docker.io`, et `apt install docker`
mène à `wmdocker`, un dock Window Maker sans rapport. `DOCKER_CLI=<commande>` impose un autre
client (podman, nerdctl).

Le conteneur écoute sur `0.0.0.0` et son port est publié sur toutes les interfaces : le site
est joignable depuis n'importe quelle machine du réseau, pas seulement en localhost.

## Les deux environnements

| | Local (Docker) | Production (Pi) |
|---|---|---|
| Port | 4707, publié sur toutes les interfaces | 8794, sur la boucle locale |
| Racine servie | `/app/dist` dans le conteneur | le dossier du projet, à plat |
| Lancement | `./start.sh` (Docker) | service systemd `lofi-engine` |
| Façade | l'IP de la machine sur le réseau | tunnel Cloudflare → lofi.christophercouspeyre.com |

La production tourne encore sans Docker, en service systemd direct : le Pi n'a pas la mémoire
pour construire l'image sur place. `deploy-pi.sh` construit sur le PC et n'envoie que le
résultat.
