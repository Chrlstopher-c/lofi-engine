/**
 * Ce qui encadre un envoi dans le chat : forme du texte, et débit.
 * Le texte vient de l'interface — entrée non fiable au même titre qu'une réponse d'API. Les
 * retours à la ligne en sortent : une ligne IRC en porte une seule, et laisser passer un CRLF
 * reviendrait à laisser écrire des commandes au serveur de chat.
 */

const MAX_CARACTERES = 480;
const CONTROLES = /[\u0000-\u001f\u007f]/g;

/** Twitch tolère 20 messages par 30 s hors modération : on reste franchement en deçà. */
const MAX_ENVOIS = 18;
const FENETRE_MS = 30_000;

/** Horodatage des envois récents, partagé par le module : le débit survit aux reconnexions. */
let envois: number[] = [];

export function texteEnvoyable(brut: unknown): string {
  const source = typeof brut === "string" ? brut : "";
  const texte = source.replace(CONTROLES, " ").trim().slice(0, MAX_CARACTERES);
  if (texte.length === 0) throw new Error("Message vide : rien à envoyer.");
  return texte;
}

/** Lève si la fenêtre glissante est pleine ; sinon enregistre l'envoi. */
export function autoriserEnvoi(maintenant: number = Date.now()): void {
  envois = envois.filter((instant) => maintenant - instant <= FENETRE_MS);
  if (envois.length >= MAX_ENVOIS) {
    const secondes = FENETRE_MS / 1000;
    throw new Error(`Débit dépassé : ${MAX_ENVOIS} messages par ${secondes} s au plus. Réessayer dans un instant.`);
  }
  envois.push(maintenant);
}

/** Remet le compteur d'envois à zéro (double de test). */
export function oublierEnvois(): void {
  envois = [];
}
