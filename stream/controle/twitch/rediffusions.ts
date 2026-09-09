/**
 * Rediffusions : les archives automatiques de la chaîne, et leur suppression.
 * Une suppression est définitive côté Twitch — l'interface la fait confirmer.
 */
import type { Rediffusion } from "./types.ts";
import { appelHelix, identifiantChaine } from "./client.ts";
import { elements, texte, texteOuVide, entier, dateIso } from "./valider.ts";
import { journal } from "../journal.ts";

const PAR_PAGE = 20;

function lireRediffusion(element: Record<string, unknown>): Rediffusion | null {
  const id = texte(element, "id");
  const publieeLe = dateIso(element, "published_at") ?? dateIso(element, "created_at");
  if (!id || !publieeLe) return null; // sans identité ni date, la ligne n'est pas exploitable
  return {
    id,
    titre: texteOuVide(element, "title") ?? "",
    duree: texte(element, "duration") ?? "",
    publieeLe,
    vues: entier(element, "view_count") ?? 0,
    url: texte(element, "url") ?? "",
  };
}

export async function listerRediffusions(): Promise<Rediffusion[]> {
  const corps = await appelHelix("/videos", {
    requete: { user_id: await identifiantChaine(), type: "archive", first: String(PAR_PAGE) },
  });
  return elements(corps)
    .map(lireRediffusion)
    .filter((r): r is Rediffusion => r !== null);
}

export async function supprimerRediffusion(brut: string): Promise<void> {
  const id = String(brut ?? "").trim();
  if (!/^\d{1,20}$/.test(id)) throw new Error("Identifiant de rediffusion invalide.");
  await appelHelix("/videos", { methode: "DELETE", requete: { id } });
  journal.info({ id }, "rediffusion supprimée");
}
