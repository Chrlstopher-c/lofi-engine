/**
 * La chaîne : titre et catégorie du live (lecture, modification), recherche de catégorie,
 * et état réel du direct. Chaque champ affiché vient d'une réponse validée — hors direct,
 * les valeurs sont nulles plutôt qu'inventées.
 */
import type { Categorie, Chaine, DirectTwitch } from "./types.ts";
import { appelHelix, identifiantChaine } from "./client.ts";
import { elements, premierElement, texte, texteOuVide, entier, dateIso } from "./valider.ts";
import { journal } from "../journal.ts";

const TITRE_MAX = 140;
const RESULTATS_MAX = 15;

export async function lireChaine(): Promise<Chaine> {
  const corps = await appelHelix("/channels", { requete: { broadcaster_id: await identifiantChaine() } });
  const chaine = premierElement(corps);
  if (!chaine) throw new Error("Twitch n'a renvoyé aucune information sur la chaîne.");
  return {
    titre: texteOuVide(chaine, "title") ?? "",
    categorieId: texte(chaine, "game_id") ?? "",
    categorieNom: texte(chaine, "game_name") ?? "",
    langue: texte(chaine, "broadcaster_language") ?? "",
  };
}

/** Ce que l'interface envoie est une entrée non fiable au même titre qu'une réponse d'API. */
function corpsModification(brut: unknown): Record<string, unknown> {
  const o = (brut ?? {}) as Record<string, unknown>;
  const corps: Record<string, unknown> = {};
  if (typeof o.titre === "string") {
    const titre = o.titre.trim().slice(0, TITRE_MAX);
    if (titre.length === 0) throw new Error("Le titre du live ne peut pas être vide.");
    corps.title = titre;
  }
  if (typeof o.categorieId === "string" && o.categorieId.trim() !== "") {
    const id = o.categorieId.trim();
    if (!/^\d{1,20}$/.test(id)) {
      throw new Error("Identifiant de catégorie invalide : choisir une catégorie dans la liste.");
    }
    corps.game_id = id;
  }
  if (Object.keys(corps).length === 0) throw new Error("Rien à modifier : indiquer un titre ou une catégorie.");
  return corps;
}

/** Twitch répond 204 sans contenu : on relit la chaîne pour renvoyer un état vérifié. */
export async function modifierChaine(brut: unknown): Promise<Chaine> {
  const corps = corpsModification(brut);
  await appelHelix("/channels", {
    methode: "PATCH",
    requete: { broadcaster_id: await identifiantChaine() },
    corps,
  });
  journal.info({ champs: Object.keys(corps) }, "chaîne Twitch modifiée");
  return lireChaine();
}

export async function chercherCategories(brut: unknown): Promise<Categorie[]> {
  const requete = typeof brut === "string" ? brut.trim().slice(0, 100) : "";
  if (requete.length < 2) return [];
  const corps = await appelHelix("/search/categories", { requete: { query: requete, first: String(RESULTATS_MAX) } });
  const trouvees: Categorie[] = [];
  for (const element of elements(corps)) {
    const id = texte(element, "id");
    const nom = texte(element, "name");
    if (id && nom) trouvees.push({ id, nom, imageUrl: texte(element, "box_art_url") ?? "" });
  }
  return trouvees;
}

/** Chaîne hors ligne : `data` est vide, et l'état l'est aussi — aucun repli. */
export async function lireDirect(): Promise<DirectTwitch> {
  const corps = await appelHelix("/streams", { requete: { user_id: await identifiantChaine() } });
  const direct = premierElement(corps);
  if (!direct) {
    return { enDirect: false, titre: null, categorieNom: null, spectateurs: null, depuis: null };
  }
  return {
    enDirect: true,
    titre: texteOuVide(direct, "title"),
    categorieNom: texte(direct, "game_name"),
    spectateurs: entier(direct, "viewer_count"),
    depuis: dateIso(direct, "started_at"),
  };
}
