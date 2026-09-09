/** État de la diffusion, relu périodiquement ; partagé entre l'en-tête et le pilotage. */
import { useCallback, useEffect, useState } from "react";
import type { EtatDiffusion } from "../../types.ts";
import { api } from "./api.ts";
import { messageErreur } from "./format.ts";

const INTERVALLE_MS = 5000;

export interface Etat {
  etat: EtatDiffusion | null;
  erreur: string | null;
  rafraichir: () => Promise<void>;
}

export function useEtat(): Etat {
  const [etat, setEtat] = useState<EtatDiffusion | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const rafraichir = useCallback(async (): Promise<void> => {
    try {
      setEtat(await api.lireEtat());
      setErreur(null);
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }, []);

  useEffect(() => {
    void rafraichir(); // première lecture ; l'erreur éventuelle est dans l'état
    const minuteur = window.setInterval(() => void rafraichir(), INTERVALLE_MS);
    return () => window.clearInterval(minuteur);
  }, [rafraichir]);

  return { etat, erreur, rafraichir };
}
