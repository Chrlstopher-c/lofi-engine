/**
 * Les deux raisons pour lesquelles une chaîne reste hors ligne alors que tout semble en ordre.
 *
 * La première : Twitch refuse la diffusion au compte. En RTMP ce refus se réduit à « Input/output
 * error » — la connexion s'ouvre, le serveur raccroche, la boucle de reconnexion tourne. Une
 * heure perdue le 2026-09-10 à écarter la clé, le réseau et l'encodeur, alors que l'API le
 * disait en une phrase.
 *
 * La seconde, plus sournoise : la clé enregistrée est celle d'un AUTRE compte. Twitch accepte
 * alors le flux sans broncher, c'est l'autre chaîne qui passe en direct, et celle qu'on regarde
 * reste hors ligne. Aucune erreur nulle part. Mesuré le même jour : compte connecté, portées
 * accordées, encodeur muet, « la chaîne n'émet pas ».
 */
import { useEffect, useState, type ReactNode } from "react";
import type { AccordCle, Aptitude as Verdict } from "../../twitch/types.ts";
import { apiTwitch } from "./api-twitch.ts";

/** Deux états de compte, pas des mesures : ils ne changent pas d'une minute à l'autre. */
const REPOS_MS = 120_000;

interface Diagnostic { aptitude: Verdict | null; accord: AccordCle | null }

function useDiagnostic(): Diagnostic {
  const [diagnostic, setDiagnostic] = useState<Diagnostic>({ aptitude: null, accord: null });

  useEffect(() => {
    let vivant = true;
    const lire = async (): Promise<void> => {
      const [aptitude, accord] = await Promise.all([
        apiTwitch.lireAptitude().catch(() => null),
        apiTwitch.lireAccordCle().catch(() => null),
      ]);
      if (vivant) setDiagnostic({ aptitude, accord });
    };
    void lire();
    const minuteur = window.setInterval(() => void lire(), REPOS_MS);
    return () => { vivant = false; window.clearInterval(minuteur); };
  }, []);

  return diagnostic;
}

function Avis({ titre, corps, aide }: { titre: string; corps: string; aide?: string }): ReactNode {
  return (
    <div className="avis danger" role="alert">
      <div>
        <strong>{titre}</strong>
        <p>{corps}</p>
        {aide ? <p className="aide">{aide}</p> : null}
      </div>
    </div>
  );
}

export function Aptitude(): ReactNode {
  const { aptitude, accord } = useDiagnostic();
  return (
    <>
      {aptitude && !aptitude.apte
        ? <Avis titre="Twitch refuse la diffusion." corps={aptitude.cause ?? ""}
            aide={aptitude.remede ?? undefined} />
        : null}
      {accord && accord.correspond === false
        ? <Avis titre="La clé de diffusion n'est pas celle de cette chaîne."
            corps={accord.message} />
        : null}
    </>
  );
}
