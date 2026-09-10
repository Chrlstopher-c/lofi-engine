/**
 * Relais de la progression d'accords, en mémoire.
 *
 * Les accords n'existent que dans le navigateur : c'est lui qui fabrique la musique. Quand
 * ffmpeg compose la scène, plus personne ne lit ce DOM — le calque des accords était donc le
 * dernier à forcer le retour au navigateur, bien plus coûteux. La page dépose ici la ligne
 * qu'elle afficherait, le diffuseur vient la chercher, ffmpeg la dessine.
 *
 * Ce qui arrive ici vient d'une page web : c'est de l'entrée non fiable, et elle finit dans un
 * filtre ffmpeg. D'où le tamis strict ci-dessous — seuls les caractères d'une progression
 * passent, le reste est refusé, jamais « nettoyé en silence ».
 */

/** Caractères d'une tonalité : « Am », « F#m », « B♭ ». */
const CLE_ADMISE = /^[A-Ga-g][#b♯♭]?[a-z]{0,6}$/;
/** Un degré : chiffre, chiffre romain, ou accord court. */
const DEGRE_ADMIS = /^[A-Ga-gIiVvi0-9#b♯♭°+/-]{1,8}$/;
const DEGRES_MAX = 16;
/** Au-delà, la ligne déposée est périmée : le moteur s'est tu ou la page a disparu. */
const PEREMPTION_MS = 15_000;

export interface Progression {
  cle: string;
  degres: string[];
  /** Index du degré en cours, -1 si aucun. */
  actif: number;
}

let derniere: { valeur: Progression; recue: number } | null = null;

/** Rend la progression si elle tient debout, null sinon. Ne corrige rien. */
export function valider(brut: unknown): Progression | null {
  if (typeof brut !== "object" || brut === null) return null;
  const objet = brut as Record<string, unknown>;
  const cle = typeof objet.cle === "string" ? objet.cle.trim() : "";
  if (!CLE_ADMISE.test(cle)) return null;
  if (!Array.isArray(objet.degres) || objet.degres.length === 0) return null;
  if (objet.degres.length > DEGRES_MAX) return null;
  const degres: string[] = [];
  for (const brutDegre of objet.degres) {
    if (typeof brutDegre !== "string") return null;
    const degre = brutDegre.trim();
    if (!DEGRE_ADMIS.test(degre)) return null;
    degres.push(degre);
  }
  const actif = typeof objet.actif === "number" && Number.isInteger(objet.actif) ? objet.actif : -1;
  return { cle, degres, actif: actif >= 0 && actif < degres.length ? actif : -1 };
}

export function deposer(valeur: Progression): void {
  derniere = { valeur, recue: Date.now() };
}

/** null si rien n'a été déposé, ou si le dépôt a vieilli : mieux vaut rien qu'un accord faux. */
export function lire(): Progression | null {
  if (!derniere) return null;
  if (Date.now() - derniere.recue > PEREMPTION_MS) return null;
  return derniere.valeur;
}

/**
 * La ligne telle qu'elle sera dessinée : « Am · i IV v VII ». Le degré en cours est encadré,
 * faute de pouvoir le mettre en couleur dans un seul tracé de texte.
 */
export function ligne(progression: Progression): string {
  const degres = progression.degres.map((degre, i) => (i === progression.actif ? `[${degre}]` : degre));
  return `${progression.cle} · ${degres.join(" ")}`;
}

/** Le bord HTTP : POST dépose, GET rend la ligne à dessiner. */
export async function repondre(req: Request, methode: string): Promise<Response> {
  if (methode === "GET") {
    const courante = lire();
    return new Response(courante ? ligne(courante) : "", {
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }
  if (methode !== "POST") return new Response("Method Not Allowed", { status: 405 });
  try {
    const valeur = valider(await req.json());
    if (!valeur) return new Response("progression refusée", { status: 400 });
    deposer(valeur);
    return new Response("", { status: 204 });
  } catch {
    return new Response("corps illisible", { status: 400 });
  }
}
