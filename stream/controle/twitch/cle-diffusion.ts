/**
 * Récupération de la clé de diffusion et dépôt dans le `.env`.
 * La clé transite du serveur Twitch au fichier de configuration sans jamais passer par
 * l'API du centre de contrôle : l'interface apprend seulement qu'une clé est enregistrée.
 */
import { lireDiffusion, ecrireDiffusion } from "../diffusion.ts";
import { appelHelix, identifiantChaine } from "./client.ts";
import { premierElement, texte } from "./valider.ts";
import { journal } from "../journal.ts";

/** Forme d'une clé Twitch : `live_<identifiant>_<aléa>`, sans caractère exotique. */
const FORME_CLE = /^[\w-]{20,200}$/;

/**
 * Écrit la clé dans le `.env` par la voie normale de la configuration de diffusion,
 * puis renvoie seulement l'existence de la clé — jamais sa valeur.
 */
export async function recupererCleDiffusion(): Promise<{ cleEnregistree: boolean }> {
  const corps = await appelHelix("/streams/key", { requete: { broadcaster_id: await identifiantChaine() } });
  const cle = texte(premierElement(corps), "stream_key");
  if (!cle || !FORME_CLE.test(cle)) {
    throw new Error("Twitch n'a pas renvoyé de clé de diffusion exploitable.");
  }
  const actuelle = await lireDiffusion();
  const relue = await ecrireDiffusion({ ...actuelle, twitchCle: cle });
  journal.info({ enregistree: relue.twitchCle }, "clé de diffusion Twitch déposée dans le .env");
  return { cleEnregistree: relue.twitchCle };
}
