/** Mises en forme propres aux données Twitch : durées de rediffusion, compte à rebours. */

function partie(valeur: string | undefined): number {
  const nombre = Number(valeur ?? 0);
  return Number.isFinite(nombre) ? nombre : 0;
}

/** Twitch donne une durée sous la forme « 3h12m5s ». Illisible telle quelle : on la rend. */
export function dureeRediffusion(brut: string): string {
  const trouve = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(brut.trim());
  if (!trouve) return brut; // forme inattendue : on montre ce que Twitch a envoyé, sans l'inventer
  const heures = partie(trouve[1]);
  const minutes = partie(trouve[2]);
  const secondes = partie(trouve[3]);
  if (heures === 0 && minutes === 0 && secondes === 0) return brut;
  if (heures > 0) return `${heures} h ${String(minutes).padStart(2, "0")} min`;
  if (minutes > 0) return `${minutes} min ${String(secondes).padStart(2, "0")} s`;
  return `${secondes} s`;
}

/** Temps restant avant une échéance ISO ; chaîne vide si la date est illisible ou passée. */
export function dureeRestante(iso: string, maintenant: number = Date.now()): string {
  const fin = Date.parse(iso);
  if (!Number.isFinite(fin)) return "";
  const secondes = Math.floor((fin - maintenant) / 1000);
  if (secondes <= 0) return "";
  const minutes = Math.floor(secondes / 60);
  return minutes > 0 ? `${minutes} min` : `${secondes} s`;
}

/** Heure d'un horodatage ISO, en « 21:04 » ; chaîne vide si la date est illisible. */
export function heureLisible(iso: string): string {
  const instant = Date.parse(iso);
  if (!Number.isFinite(instant)) return "";
  return new Date(instant).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function nombreLisible(valeur: number): string {
  return new Intl.NumberFormat("fr-FR").format(valeur);
}

export interface SegmentDuree {
  valeur: string;
  unite: string;
}

/**
 * Durée écoulée depuis une date ISO, découpée en « 14 · h · 32 · min » pour l'affichage :
 * la valeur est grande, l'unité petite à côté. Vide si la date est illisible.
 */
export function segmentsDepuis(iso: string | null, maintenant: number = Date.now()): SegmentDuree[] {
  if (!iso) return [];
  const debut = Date.parse(iso);
  if (!Number.isFinite(debut)) return [];
  const total = Math.max(0, Math.floor((maintenant - debut) / 1000));
  const heures = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (heures > 0) {
    return [{ valeur: String(heures), unite: "h" }, { valeur: String(minutes).padStart(2, "0"), unite: "" }];
  }
  return [{ valeur: String(minutes), unite: "min" }];
}
