/**
 * Toute réponse de Twitch est une entrée non fiable : rien n'est utilisé sans être vérifié ici.
 * Chaque lecture répond « la valeur attendue » ou « rien », jamais une valeur inventée.
 */

export function objet(valeur: unknown): Record<string, unknown> | null {
  return typeof valeur === "object" && valeur !== null && !Array.isArray(valeur)
    ? (valeur as Record<string, unknown>)
    : null;
}

/** Chaîne non vide, ou `null`. */
export function texte(source: Record<string, unknown> | null, cle: string): string | null {
  const valeur = source?.[cle];
  if (typeof valeur !== "string") return null;
  const nette = valeur.trim();
  return nette.length > 0 ? nette : null;
}

/** Chaîne éventuellement vide (un titre de live peut légitimement l'être), ou `null` si absente. */
export function texteOuVide(source: Record<string, unknown> | null, cle: string): string | null {
  const valeur = source?.[cle];
  return typeof valeur === "string" ? valeur : null;
}

export function entier(source: Record<string, unknown> | null, cle: string): number | null {
  const valeur = source?.[cle];
  if (typeof valeur === "number" && Number.isFinite(valeur)) return Math.trunc(valeur);
  if (typeof valeur === "string" && /^\d{1,15}$/.test(valeur)) return Number(valeur);
  return null;
}

/** Date ISO valide, ou `null`. Une date illisible n'est jamais remplacée par « maintenant ». */
export function dateIso(source: Record<string, unknown> | null, cle: string): string | null {
  const brut = texte(source, cle);
  if (!brut) return null;
  const instant = Date.parse(brut);
  return Number.isFinite(instant) ? new Date(instant).toISOString() : null;
}

export function listeTextes(source: Record<string, unknown> | null, cle: string): string[] {
  const valeur = source?.[cle];
  if (!Array.isArray(valeur)) return [];
  return valeur.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

/** Le tableau `data` que porte toute réponse Helix, réduit à ses seuls éléments objets. */
export function elements(corps: unknown, cle = "data"): Record<string, unknown>[] {
  const racine = objet(corps);
  const donnees = racine?.[cle];
  if (!Array.isArray(donnees)) return [];
  return donnees.map(objet).filter((e): e is Record<string, unknown> => e !== null);
}

export function premierElement(corps: unknown, cle = "data"): Record<string, unknown> | null {
  return elements(corps, cle)[0] ?? null;
}

/**
 * Message d'erreur écrit par Twitch, remonté tel quel : il est explicite et souvent
 * actionnable (« Missing scope: … »). À défaut, on rend compte du statut HTTP.
 */
export function messageTwitch(corps: unknown, statut: number): string {
  const racine = objet(corps);
  const message = texte(racine, "message") ?? texte(racine, "error_description") ?? texte(racine, "error");
  return message ?? `Twitch a répondu ${statut} sans message.`;
}
