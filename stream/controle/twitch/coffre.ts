/**
 * Coffre des identifiants Twitch : Client ID et jetons.
 * Il vit dans le corpus, hors dépôt, et n'est lisible que par son propriétaire (0600).
 * Rien de ce qu'il contient ne ressort par l'API : l'interface n'en apprend que l'existence.
 */
import { resolve, dirname } from "node:path";
import { chmod, mkdir } from "node:fs/promises";
import type { Coffre } from "./types.ts";
import { journal } from "../journal.ts";
import { objet, texte, entier, listeTextes } from "./valider.ts";

const CORPUS = resolve(process.env.CORPUS_DIR ?? resolve(import.meta.dir, "../../../corpus"));
const FICHIER = resolve(CORPUS, "twitch-jetons.json");

const VIDE: Coffre = {
  clientId: "", jetonAcces: "", jetonRafraichissement: "",
  expireA: 0, portees: [], utilisateurId: "", utilisateurLogin: "",
};

/** Le fichier a pu être édité à la main : on ne garde que ce qui a la forme attendue. */
function normaliser(brut: unknown): Coffre {
  const o = objet(brut);
  if (!o) return { ...VIDE };
  return {
    clientId: texte(o, "clientId") ?? "",
    jetonAcces: texte(o, "jetonAcces") ?? "",
    jetonRafraichissement: texte(o, "jetonRafraichissement") ?? "",
    expireA: entier(o, "expireA") ?? 0,
    portees: listeTextes(o, "portees"),
    utilisateurId: texte(o, "utilisateurId") ?? "",
    utilisateurLogin: texte(o, "utilisateurLogin") ?? "",
  };
}

export async function lireCoffre(): Promise<Coffre> {
  try {
    const f = Bun.file(FICHIER);
    if (!(await f.exists())) return { ...VIDE };
    return normaliser(await f.json());
  } catch (erreur) {
    journal.error({ erreur, fichier: FICHIER }, "coffre Twitch illisible");
    return { ...VIDE };
  }
}

/** Écrit le coffre puis restreint les droits : personne d'autre que le propriétaire. */
async function ecrireCoffre(coffre: Coffre): Promise<void> {
  try {
    await mkdir(dirname(FICHIER), { recursive: true });
    await Bun.write(FICHIER, JSON.stringify(coffre, null, 2));
    await chmod(FICHIER, 0o600);
  } catch (erreur) {
    journal.error({ erreur, fichier: FICHIER }, "écriture du coffre Twitch impossible");
    throw new Error("Enregistrement des identifiants Twitch impossible (voir le journal du serveur).");
  }
}

/** Un Client ID Twitch est une chaîne alphanumérique de 30 caractères. */
export async function enregistrerApplication(brut: unknown): Promise<void> {
  const clientId = typeof brut === "string" ? brut.trim() : "";
  if (!/^[a-z0-9]{20,40}$/i.test(clientId)) {
    throw new Error("Client ID invalide : 20 à 40 caractères alphanumériques attendus.");
  }
  const actuel = await lireCoffre();
  // Changer d'application invalide les jetons obtenus avec la précédente : on les jette.
  const jetons = actuel.clientId === clientId ? actuel : VIDE;
  await ecrireCoffre({ ...jetons, clientId });
  journal.info({ conserve: actuel.clientId === clientId }, "application Twitch enregistrée");
}

export interface JetonsRecus {
  jetonAcces: string;
  jetonRafraichissement: string;
  /** Durée de vie annoncée par Twitch, en secondes. */
  dureeSecondes: number;
  portees: string[];
}

export async function enregistrerJetons(jetons: JetonsRecus): Promise<Coffre> {
  const actuel = await lireCoffre();
  const coffre: Coffre = {
    ...actuel,
    jetonAcces: jetons.jetonAcces,
    jetonRafraichissement: jetons.jetonRafraichissement,
    expireA: Date.now() + jetons.dureeSecondes * 1000,
    portees: jetons.portees,
  };
  await ecrireCoffre(coffre);
  journal.info({ portees: jetons.portees, dureeSecondes: jetons.dureeSecondes }, "jetons Twitch enregistrés");
  return coffre;
}

export async function enregistrerUtilisateur(id: string, login: string): Promise<Coffre> {
  const coffre = { ...(await lireCoffre()), utilisateurId: id, utilisateurLogin: login };
  await ecrireCoffre(coffre);
  journal.info({ login }, "chaîne Twitch identifiée");
  return coffre;
}

/** Déconnexion : les jetons partent, le Client ID reste pour pouvoir se reconnecter. */
export async function effacerJetons(): Promise<void> {
  const { clientId } = await lireCoffre();
  await ecrireCoffre({ ...VIDE, clientId });
  journal.info("compte Twitch déconnecté, jetons effacés");
}
