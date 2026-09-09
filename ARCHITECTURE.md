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

## Les deux environnements

| | Local | Production (Pi) |
|---|---|---|
| Port | 4707 | 8794 |
| Racine servie | `./dist` | le dossier du projet, à plat |
| Lancement | `./start.sh` | service systemd `lofi-engine` |
| Façade | aucune | tunnel Cloudflare → lofi.christophercouspeyre.com |

Le build ne tourne **jamais** sur le Pi : il réclame près de 1,9 Go de mémoire, la machine n'en
a pas la moitié de libre. `deploy-pi.sh` construit sur le PC et n'envoie que le résultat.
