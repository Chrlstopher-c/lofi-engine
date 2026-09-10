/**
 * Pourquoi Twitch refuse la diffusion.
 *
 * En RTMP, un refus se réduit à « Input/output error » : la connexion s'ouvre, le serveur
 * raccroche, et la boucle de reconnexion tourne indéfiniment sans jamais dire pourquoi. Mesuré
 * le 2026-09-10 : une heure passée à écarter la clé, le réseau, l'encodeur et notre propre
 * chaîne, alors que l'API Twitch répondait en une phrase — « A verified phone number is
 * required to stream ».
 *
 * Cette sonde pose la question à l'API quand le flux part sans que la chaîne passe en direct.
 * Elle ne corrige rien ; elle nomme.
 */
import { appelHelix, identifiantChaine } from "./client.ts";
import { journal } from "../journal.ts";

/** Ce que Twitch reproche, traduit pour l'interface. */
const CAUSES: ReadonlyArray<{ motif: RegExp; cause: string; remede: string }> = [
  {
    motif: /verified phone number/i,
    cause: "Twitch exige un numéro de téléphone vérifié sur le compte pour diffuser.",
    remede: "twitch.tv/settings/security — ajouter et valider le numéro. Le numéro utilisé pour "
      + "la double authentification ne compte pas : ce sont deux registres distincts.",
  },
  {
    motif: /suspended|banned/i,
    cause: "Le compte est suspendu : Twitch refuse toute ingestion.",
    remede: "Voir les notifications du compte sur twitch.tv.",
  },
  {
    motif: /unauthorized|invalid.*token|401/i,
    cause: "L'autorisation Twitch n'est plus valable.",
    remede: "Onglet Twitch : se déconnecter puis réautoriser le compte.",
  },
  {
    motif: /missing scope|403/i,
    cause: "Il manque une portée à l'autorisation Twitch.",
    remede: "Onglet Twitch : se déconnecter puis réautoriser, en acceptant toutes les portées.",
  },
];

export interface Aptitude {
  /** true quand Twitch accepterait une diffusion pour autant qu'on puisse le savoir. */
  apte: boolean;
  cause: string | null;
  remede: string | null;
}

const APTE: Aptitude = { apte: true, cause: null, remede: null };

function interpreter(message: string): Aptitude {
  for (const { motif, cause, remede } of CAUSES) {
    if (motif.test(message)) return { apte: false, cause, remede };
  }
  // Une cause inconnue vaut mieux qu'un silence : on rend le message tel quel.
  return { apte: false, cause: `Twitch a refusé : ${message.slice(0, 200)}`, remede: null };
}

/**
 * Interroge l'endpoint de clé de diffusion, qui est le seul à refuser explicitement quand le
 * compte n'a pas le droit de diffuser. La clé renvoyée n'est ni lue ni conservée ici.
 */
export async function verifierAptitude(): Promise<Aptitude> {
  try {
    await appelHelix("/streams/key", { requete: { broadcaster_id: await identifiantChaine() } });
    return APTE;
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : String(erreur);
    const verdict = interpreter(message);
    journal.warn({ cause: verdict.cause }, "Twitch refuse la diffusion");
    return verdict;
  }
}
