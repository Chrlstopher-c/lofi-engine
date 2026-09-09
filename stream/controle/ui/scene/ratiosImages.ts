/**
 * Proportions réelles des images utilisées par les calques, mesurées en les chargeant.
 * Sert à donner au cadre d'un calque image la même forme qu'à l'écran ; tant qu'une image
 * n'est pas mesurée, rien n'est inventé : on retombe sur le carré.
 */
import { useEffect, useState } from "react";
import type { Calque } from "../../types.ts";
import { urlFond } from "../commun/api.ts";

/** Hauteur rapportée à la largeur, faute de mesure. */
export const RATIO_INCONNU = 1;

export type Ratios = Readonly<Record<string, number>>;

function fichiersImages(calques: Calque[]): string[] {
  const noms = calques.filter((c) => c.type === "image" && c.fichier).map((c) => c.fichier ?? "");
  return Array.from(new Set(noms));
}

/** Charge les images non encore mesurées et range leur proportion ; les échecs gardent le défaut. */
export function useRatiosImages(calques: Calque[]): Ratios {
  const [ratios, setRatios] = useState<Record<string, number>>({});
  const aMesurer = fichiersImages(calques).filter((f) => ratios[f] === undefined).join("\n");

  useEffect(() => {
    if (aMesurer === "") return;
    let vivant = true;
    for (const fichier of aMesurer.split("\n")) {
      const image = new Image();
      const poser = (valeur: number): void => {
        if (vivant) setRatios((actuels) => ({ ...actuels, [fichier]: valeur }));
      };
      image.onload = (): void => { if (image.naturalWidth > 0) poser(image.naturalHeight / image.naturalWidth); };
      // Image absente ou illisible : le cadre garde le ratio par défaut, sans message d'erreur.
      image.onerror = (): void => poser(RATIO_INCONNU);
      image.src = urlFond(fichier);
    }
    return () => { vivant = false; };
  }, [aMesurer]);

  return ratios;
}
