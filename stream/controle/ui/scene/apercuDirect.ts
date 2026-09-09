/**
 * Envoi de la scène en cours d'édition à l'aperçu, sans passer par le fichier enregistré.
 * La scène n'écoute ces messages qu'en mode ?apercu=1 (voir stream/scene/scene.js) ; dès le
 * premier message reçu elle cesse de relire le fichier, l'édition prime.
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { Scene } from "../../types.ts";
import { origineScene } from "../commun/api.ts";
import { messageErreur } from "../commun/format.ts";

/**
 * Assez court pour suivre un curseur à l'œil, assez long pour ne pas inonder l'iframe.
 * L'attente est un intervalle minimum entre deux envois, pas une attente d'immobilité :
 * pendant un glissement continu l'aperçu suit, à raison d'un message toutes les 120 ms.
 */
const DELAI_MS = 120;

export interface ApercuDirect {
  cadre: RefObject<HTMLIFrameElement | null>;
  /** À brancher sur le load de l'iframe : la scène n'écoute qu'une fois son script exécuté. */
  surCharge: () => void;
  /** Vrai dès qu'un message est parti : l'aperçu montre alors l'édition, plus le fichier. */
  pilote: boolean;
  erreur: string | null;
}

export function useApercuDirect(scene: Scene | null): ApercuDirect {
  const cadre = useRef<HTMLIFrameElement | null>(null);
  const derniere = useRef<Scene | null>(scene);
  derniere.current = scene;
  const dernierEnvoi = useRef(0);
  const [pilote, setPilote] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const envoyer = useCallback((): void => {
    const fenetre = cadre.current?.contentWindow;
    const valeur = derniere.current;
    if (!fenetre || !valeur) return;
    dernierEnvoi.current = Date.now();
    try {
      fenetre.postMessage({ type: "scene-apercu", scene: valeur }, origineScene());
      setPilote(true);
      setErreur(null);
    } catch (e) {
      setErreur(`Aperçu en direct impossible : ${messageErreur(e)}`);
    }
  }, []);

  // La scène sérialisée sert de déclencheur : un rendu qui ne la change pas n'envoie rien.
  const empreinte = scene === null ? "" : JSON.stringify(scene);
  useEffect(() => {
    if (empreinte === "") return;
    const reste = Math.max(0, DELAI_MS - (Date.now() - dernierEnvoi.current));
    const minuteur = window.setTimeout(envoyer, reste);
    return () => window.clearTimeout(minuteur);
  }, [empreinte, envoyer]);

  return { cadre, surCharge: envoyer, pilote, erreur };
}
