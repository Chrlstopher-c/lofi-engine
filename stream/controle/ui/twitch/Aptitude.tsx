/**
 * Le bandeau qui dit pourquoi Twitch refuse la diffusion.
 *
 * En RTMP, un refus se réduit à « Input/output error » : la connexion s'ouvre, le serveur
 * raccroche, la boucle de reconnexion tourne. Une heure a été perdue le 2026-09-10 à écarter
 * la clé, le réseau et l'encodeur, alors que l'API de Twitch répondait en une phrase. Ce
 * bandeau pose la question et affiche la réponse — la sonde existait déjà, elle n'était
 * branchée nulle part.
 */
import { useEffect, useState, type ReactNode } from "react";
import type { Aptitude as Verdict } from "../../twitch/types.ts";
import { apiTwitch } from "./api-twitch.ts";

/** La réponse ne change pas d'une minute à l'autre : c'est un état de compte, pas une mesure. */
const REPOS_MS = 120_000;

export function Aptitude(): ReactNode {
  const [verdict, setVerdict] = useState<Verdict | null>(null);

  useEffect(() => {
    let vivant = true;
    const lire = async (): Promise<void> => {
      try {
        const r = await apiTwitch.lireAptitude();
        if (vivant) setVerdict(r);
      } catch {
        // Sonde muette : on n'affiche rien plutôt qu'une fausse alerte.
        if (vivant) setVerdict(null);
      }
    };
    void lire();
    const minuteur = window.setInterval(() => void lire(), REPOS_MS);
    return () => { vivant = false; window.clearInterval(minuteur); };
  }, []);

  if (!verdict || verdict.apte) return null;
  return (
    <div className="avis danger" role="alert">
      <div>
        <strong>Twitch refuse la diffusion.</strong>
        <p>{verdict.cause}</p>
        {verdict.remede ? <p className="aide">{verdict.remede}</p> : null}
      </div>
    </div>
  );
}
