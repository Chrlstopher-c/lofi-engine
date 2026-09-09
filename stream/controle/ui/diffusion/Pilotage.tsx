/**
 * État de l'antenne et l'unique action qui la commande : démarrer, ou arrêter.
 * Lisible de loin — la durée du direct est le plus gros élément de la page.
 */
import { Fragment, useState, type ReactNode } from "react";
import type { EtatDiffusion } from "../../types.ts";
import { api } from "../commun/api.ts";
import { Alerte, Bouton, Voyant } from "../commun/composants.tsx";
import { dateLisible, messageErreur } from "../commun/format.ts";
import type { Etat } from "../commun/useEtat.ts";
import { segmentsDuree, useHorloge } from "./format-diffusion.ts";

interface Props { etat: Etat; modifie: boolean; }

const AIDE_MARCHE = "Les réglages enregistrés seront relus au prochain démarrage.";
const AIDE_ARRET = "Première mise en route : cinq à dix minutes de construction de l'image, "
  + "puis le direct démarre seul.";
const AIDE_CONSTRUCTION = "La diffusion démarrera d'elle-même une fois l'image construite.";
const AVIS_NON_ENREGISTRE = "Des réglages ne sont pas enregistrés. Le démarrage utilisera la configuration "
  + "enregistrée, pas celle affichée.";

/** Durée du direct, rafraîchie à la seconde. */
function Duree({ depuis }: { depuis: string | null }): ReactNode {
  const maintenant = useHorloge(true);
  const segments = segmentsDuree(depuis, maintenant);
  if (segments.length === 0) return <>En marche</>;
  return (
    <>
      {segments.map((segment) => (
        <Fragment key={segment.unite}>{segment.valeur}<small>{segment.unite}</small></Fragment>
      ))}
    </>
  );
}

function Origine({ etat }: { etat: EtatDiffusion }): ReactNode {
  const depuis = dateLisible(etat.depuis);
  return (
    <>
      {depuis ? `Démarrée le ${depuis}` : "En marche"}
      {etat.conteneur ? <> · conteneur <span className="mono">{etat.conteneur}</span></> : null}
    </>
  );
}

interface Lecture {
  sens: "neutre" | "warn" | "danger";
  libelle: string;
  duree: ReactNode;
  detail: ReactNode;
  aide: string;
}

/** Le rouge de l'antenne vient de `.app.direct`, posé par la coquille : rien à faire ici. */
function lire(etat: EtatDiffusion | null, erreur: string | null): Lecture {
  if (!etat) {
    return {
      sens: erreur ? "danger" : "neutre", libelle: erreur ? "État indisponible" : "Lecture…",
      duree: "…", detail: erreur ?? "", aide: "",
    };
  }
  if (etat.construction) {
    return {
      sens: "warn", libelle: "Construction", duree: "Image en cours",
      detail: "Première mise en route du diffuseur — cinq à dix minutes.", aide: AIDE_CONSTRUCTION,
    };
  }
  if (etat.enMarche) {
    return {
      sens: "neutre", libelle: "À l'antenne", duree: <Duree depuis={etat.depuis} />,
      detail: <Origine etat={etat} />, aide: AIDE_MARCHE,
    };
  }
  return {
    sens: "neutre", libelle: "Hors antenne", duree: "À l'arrêt",
    detail: "Aucun conteneur en marche.", aide: AIDE_ARRET,
  };
}

type Action = () => Promise<{ ok: boolean; sortie: string }>;

interface Commande {
  occupe: boolean;
  erreur: string | null;
  oublier: () => void;
  lancer: (action: Action) => Promise<void>;
}

/** Démarrage et arrêt : une action à la fois, et l'état relu quoi qu'il arrive. */
function useCommande(etat: Etat): Commande {
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  const lancer = async (action: Action): Promise<void> => {
    setOccupe(true);
    try {
      await action();
      setErreur(null);
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setOccupe(false);
      await etat.rafraichir();
    }
  };

  return { occupe, erreur, oublier: () => setErreur(null), lancer };
}

export function Pilotage({ etat, modifie }: Props): ReactNode {
  const commande = useCommande(etat);
  const enMarche = etat.etat?.enMarche === true;
  const vue = lire(etat.etat, etat.erreur);
  return (
    <>
      <section className="panneau pilotage">
        <div className="pilotage-etat">
          <span className="sur"><Voyant sens={vue.sens} />{vue.libelle}</span>
          <h2>{vue.duree}</h2>
          <p>{vue.detail}</p>
        </div>
        <div className="pilotage-actions">
          <Bouton taille="lg" variante={enMarche ? "danger" : "direct"} plein={enMarche}
            encours={commande.occupe}
            onClick={() => void commande.lancer(enMarche ? api.arreter : api.demarrer)}>
            {enMarche ? "Arrêter la diffusion" : "Démarrer la diffusion"}
          </Bouton>
          {vue.aide ? <span className="aide">{vue.aide}</span> : null}
        </div>
      </section>
      {modifie ? <Alerte niveau="attention" message={AVIS_NON_ENREGISTRE} /> : null}
      <Alerte message={commande.erreur} onFermer={commande.oublier} />
    </>
  );
}
