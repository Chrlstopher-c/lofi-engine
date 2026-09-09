/** Mise en forme des valeurs affichées : tailles, durées, dates. */

const UNITES = ["o", "Ko", "Mo", "Go", "To"];

export function octetsLisibles(octets: number): string {
  if (!Number.isFinite(octets) || octets < 0) return "—";
  let valeur = octets;
  let rang = 0;
  while (valeur >= 1024 && rang < UNITES.length - 1) {
    valeur /= 1024;
    rang += 1;
  }
  const decimales = rang === 0 || valeur >= 100 ? 0 : 1;
  return `${valeur.toFixed(decimales).replace(".", ",")} ${UNITES[rang]}`;
}

/** Durée écoulée depuis une date ISO, en « 2 h 05 min » ; vide si la date est illisible. */
export function dureeDepuis(iso: string | null, maintenant: number = Date.now()): string {
  if (!iso) return "";
  const debut = Date.parse(iso);
  if (!Number.isFinite(debut)) return "";
  const secondes = Math.max(0, Math.floor((maintenant - debut) / 1000));
  const jours = Math.floor(secondes / 86_400);
  const heures = Math.floor((secondes % 86_400) / 3600);
  const minutes = Math.floor((secondes % 3600) / 60);
  if (jours > 0) return `${jours} j ${String(heures).padStart(2, "0")} h`;
  if (heures > 0) return `${heures} h ${String(minutes).padStart(2, "0")} min`;
  if (minutes > 0) return `${minutes} min`;
  return `${secondes} s`;
}

export function dateLisible(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

export function messageErreur(erreur: unknown): string {
  return erreur instanceof Error ? erreur.message : String(erreur);
}
