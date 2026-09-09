/** Mises en forme propres au pilotage : durée découpée pour l'affichage en grand. */
import { useEffect, useState } from "react";

export interface SegmentDuree {
  valeur: string;
  unite: string;
}

function deuxChiffres(nombre: number): string {
  return String(nombre).padStart(2, "0");
}

/**
 * Durée écoulée depuis une date ISO, en segments « 14 · h · 32 · min · 07 · s ».
 * Le découpage sert l'affichage : la valeur est grande, l'unité petite à côté.
 */
export function segmentsDuree(iso: string | null, maintenant: number = Date.now()): SegmentDuree[] {
  if (!iso) return [];
  const debut = Date.parse(iso);
  if (!Number.isFinite(debut)) return [];
  const total = Math.max(0, Math.floor((maintenant - debut) / 1000));
  const heures = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secondes = total % 60;
  if (heures > 0) {
    return [
      { valeur: String(heures), unite: "h" },
      { valeur: deuxChiffres(minutes), unite: "min" },
      { valeur: deuxChiffres(secondes), unite: "s" },
    ];
  }
  if (minutes > 0) {
    return [{ valeur: String(minutes), unite: "min" }, { valeur: deuxChiffres(secondes), unite: "s" }];
  }
  return [{ valeur: String(secondes), unite: "s" }];
}

/** Réveille le rendu chaque seconde tant que `actif` : la durée affichée suit l'horloge. */
export function useHorloge(actif: boolean): number {
  const [instant, setInstant] = useState<number>(() => Date.now());
  useEffect(() => {
    if (!actif) return undefined;
    setInstant(Date.now()); // reprise après une pause : on repart de l'heure réelle
    const minuteur = window.setInterval(() => setInstant(Date.now()), 1000);
    return () => window.clearInterval(minuteur);
  }, [actif]);
  return instant;
}
