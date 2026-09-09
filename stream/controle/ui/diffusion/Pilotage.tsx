/** Démarrer / arrêter la diffusion, état lisible, journal du conteneur rafraîchi tant que ça tourne. */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { api } from "../commun/api.ts";
import { Alerte, Bouton } from "../commun/composants.tsx";
import { dateLisible, dureeDepuis, messageErreur } from "../commun/format.ts";
import type { Etat } from "../commun/useEtat.ts";

interface Props { etat: Etat; modifie: boolean; }

const JOURNAL_MS = 3000;
const AVIS_NON_ENREGISTRE =
  "Des réglages ne sont pas enregistrés : le démarrage utilisera la configuration enregistrée.";

interface Journal { texte: string; erreur: string | null; relire: () => Promise<void>; }

function useJournal(actif: boolean): Journal {
  const [texte, setTexte] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const relire = useCallback(async (): Promise<void> => {
    try {
      setTexte(await api.lireJournal());
      setErreur(null);
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }, []);
  useEffect(() => {
    void relire(); // lecture initiale, puis périodique seulement en marche
    if (!actif) return undefined;
    const minuteur = window.setInterval(() => void relire(), JOURNAL_MS);
    return () => window.clearInterval(minuteur);
  }, [relire, actif]);
  return { texte, erreur, relire };
}

function Statut({ etat }: { etat: Etat }): ReactNode {
  const e = etat.etat;
  if (!e) return <p className="discret">{etat.erreur ? `État indisponible : ${etat.erreur}` : "Lecture de l'état…"}</p>;
  if (e.construction) {
    return (
      <p className="statut construction">
        Construction de l'image du diffuseur…
        <span className="discret"> — première mise en route, cinq à dix minutes. </span>
        <span className="discret">La diffusion démarrera ensuite toute seule.</span>
      </p>
    );
  }
  if (!e.enMarche) return <p className="statut arret">À l'arrêt</p>;
  return (
    <p className="statut marche">
      En marche depuis {dureeDepuis(e.depuis) || "un instant"}
      {e.depuis ? <span className="discret"> — démarrée le {dateLisible(e.depuis)}</span> : null}
      {e.conteneur ? <span className="discret mono"> · {e.conteneur}</span> : null}
    </p>
  );
}

type Action = () => Promise<{ ok: boolean; sortie: string }>;

interface BoutonsProps { enMarche: boolean; occupe: boolean; onAgir: (action: Action) => void; }

function BoutonsPilotage({ enMarche, occupe, onAgir }: BoutonsProps): ReactNode {
  if (enMarche) {
    return (
      <Bouton variante="danger" desactive={occupe} onClick={() => onAgir(api.arreter)}>
        {occupe ? "Arrêt…" : "Arrêter la diffusion"}
      </Bouton>
    );
  }
  return (
    <Bouton variante="principal" desactive={occupe} onClick={() => onAgir(api.demarrer)}>
      {occupe ? "Démarrage…" : "Démarrer la diffusion"}
    </Bouton>
  );
}

export function Pilotage({ etat, modifie }: Props): ReactNode {
  const enMarche = etat.etat?.enMarche === true;
  // On suit le journal aussi pendant la construction : c'est le seul retour visible.
  const journal = useJournal(enMarche || etat.etat?.construction === true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  async function agir(action: Action): Promise<void> {
    setOccupe(true);
    try {
      await action();
      setErreur(null);
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setOccupe(false);
      await etat.rafraichir();
      await journal.relire();
    }
  }

  return (
    <div className="pilotage">
      <div className="pilotage-entete">
        <Statut etat={etat} />
        <BoutonsPilotage enMarche={enMarche} occupe={occupe} onAgir={(a) => void agir(a)} />
      </div>
      {modifie ? <Alerte niveau="info" message={AVIS_NON_ENREGISTRE} /> : null}
      <Alerte message={erreur} onFermer={() => setErreur(null)} />
      <Alerte message={journal.erreur} />
      <pre className="journal" aria-live="polite">{journal.texte || "…"}</pre>
    </div>
  );
}
