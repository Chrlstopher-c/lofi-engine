/**
 * Récupération de la clé de diffusion et dépôt dans le `.env`.
 * La clé transite du serveur Twitch au fichier de configuration sans jamais passer par
 * l'API du centre de contrôle : l'interface apprend seulement qu'une clé est enregistrée.
 */
import { lireDiffusion, ecrireDiffusion } from "../diffusion.ts";
import { lireEnv } from "../env.ts";
import type { AccordCle } from "./types.ts";
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


/**
 * La clé enregistrée est-elle bien celle de la chaîne connectée ?
 *
 * Un flux poussé avec la clé d'un AUTRE compte ne produit aucune erreur : Twitch l'accepte,
 * et c'est l'autre chaîne qui passe en direct. Vu de l'exploitant, ffmpeg ne se plaint de rien
 * et sa chaîne reste hors ligne — un silence impossible à interpréter sans cette comparaison.
 * Mesuré le 2026-09-10 : compte connecté, portées accordées, aucune erreur d'encodage, et
 * « la chaîne n'émet pas ».
 *
 * Les deux clés sont comparées dans le serveur et aucune n'en ressort, pas même tronquée.
 */
export async function verifierAccordCle(): Promise<AccordCle> {
  const enregistree = ((await lireEnv()).get("TWITCH_STREAM_KEY") ?? "").trim();
  if (!enregistree) {
    return { enregistree: false, correspond: null,
      message: "Aucune clé de diffusion enregistrée." };
  }
  let attendue = "";
  try {
    const corps = await appelHelix("/streams/key",
      { requete: { broadcaster_id: await identifiantChaine() } });
    attendue = texte(premierElement(corps), "stream_key").trim();
  } catch (erreur) {
    journal.warn({ erreur }, "clé de la chaîne illisible");
    return { enregistree: true, correspond: null,
      message: "Twitch n'a pas répondu : impossible de comparer." };
  }
  if (!attendue) {
    return { enregistree: true, correspond: null,
      message: "Twitch n'a pas renvoyé de clé pour cette chaîne." };
  }
  const correspond = enregistree === attendue;
  return {
    enregistree: true,
    correspond,
    message: correspond
      ? "La clé enregistrée est bien celle de cette chaîne."
      : "La clé enregistrée n'est PAS celle de cette chaîne : le flux part vers un autre "
        + "compte, ce qui ne produit aucune erreur et laisse cette chaîne hors ligne. "
        + "« Récupérer la clé » écrit la bonne, puis il faut relancer la diffusion.",
  };
}
