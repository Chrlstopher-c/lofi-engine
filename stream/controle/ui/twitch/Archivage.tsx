/**
 * Archivage des rediffusions : ce que Twitch laisse faire, et ce qu'il ne laisse pas.
 *
 * L'API ne permet ni d'activer ni de désactiver l'enregistrement des diffusions passées —
 * le réglage n'existe que dans le tableau de bord Twitch. Plutôt que d'afficher un
 * interrupteur qui ne piloterait rien, ce bloc le dit et renvoie au bon écran.
 *
 * Ce que l'API permet : supprimer. D'où l'option ci-dessous, à activer, qui n'efface que
 * les archives apparues après son activation, et jamais sans confirmation.
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { Archivage as ReglageArchivage } from "../../twitch/types.ts";
import { Alerte, Bascule } from "../commun/composants.tsx";
import { dateLisible, messageErreur } from "../commun/format.ts";
import { apiTwitch } from "./api-twitch.ts";

const TABLEAU_DE_BORD = "https://dashboard.twitch.tv/settings/stream";

function Constat({ nombre }: { nombre: number | null }): ReactNode {
  if (nombre === null) return null;
  if (nombre === 0) return <span className="etiquette ok">Aucune rediffusion archivée</span>;
  const pluriel = nombre > 1 ? "s" : "";
  return <span className="etiquette attention">{`${nombre} rediffusion${pluriel} archivée${pluriel}`}</span>;
}

function Explication({ nombre }: { nombre: number | null }): ReactNode {
  return (
    <div className="archivage-avis">
      <p>
        <strong>L'archivage ne se règle pas ici.</strong> L'API Twitch n'expose pas
        « Store past broadcasts » : ni pour l'activer, ni pour le couper. Le réglage se trouve
        uniquement dans <a className="lien" href={TABLEAU_DE_BORD} target="_blank" rel="noreferrer">
          les paramètres de diffusion Twitch</a> — à vérifier avant de lancer le stream.
      </p>
      <div className="ligne-actions">
        <span className="discret">État constaté sur la chaîne :</span>
        <Constat nombre={nombre} />
      </div>
    </div>
  );
}

const INACTIVE = "Désactivée. Une fois active, toute rediffusion apparue ensuite sera effacée "
  + "définitivement sur Twitch ; celles déjà présentes restent.";

function active(reglage: ReglageArchivage): string {
  return `Active depuis le ${dateLisible(reglage.depuis)} — ${reglage.supprimees} rediffusion(s) supprimée(s). `
    + "Les archives publiées avant cette date ne sont jamais touchées.";
}

function Option({ reglage, occupe, onBasculer }: {
  reglage: ReglageArchivage; occupe: boolean; onBasculer: (actif: boolean) => void;
}): ReactNode {
  return (
    <div className="archivage-option">
      <Bascule libelle="Supprimer automatiquement les nouvelles rediffusions" actif={reglage.suppressionAuto}
        onChange={(actif) => { if (!occupe) onBasculer(actif); }} />
      <p className="discret">{reglage.suppressionAuto ? active(reglage) : INACTIVE}</p>
    </div>
  );
}

interface Reglage {
  reglage: ReglageArchivage | null;
  erreur: string | null;
  occupe: boolean;
  setErreur: (erreur: string | null) => void;
  basculer: (actif: boolean) => Promise<void>;
}

const CONFIRMATION = "Activer la suppression automatique ?\n\nToute rediffusion apparue à partir de maintenant "
  + "sera effacée définitivement sur Twitch, sans autre confirmation. Les archives déjà présentes ne seront "
  + "pas touchées.";

function useReglage(): Reglage {
  const [reglage, setReglage] = useState<ReglageArchivage | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  const lire = useCallback(async (): Promise<void> => {
    try {
      setReglage(await apiTwitch.lireArchivage());
      setErreur(null);
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }, []);

  useEffect(() => { void lire(); }, [lire]);

  /** Une suppression de rediffusion est irréversible : l'activation se confirme. */
  const basculer = async (actif: boolean): Promise<void> => {
    if (actif && !window.confirm(CONFIRMATION)) return;
    setOccupe(true);
    try {
      setReglage(await apiTwitch.definirSuppressionAuto(actif));
      setErreur(null);
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setOccupe(false);
    }
  };

  return { reglage, erreur, occupe, setErreur, basculer };
}

export function Archivage({ nombre }: { nombre: number | null }): ReactNode {
  const { reglage, erreur, occupe, setErreur, basculer } = useReglage();
  return (
    <div className="archivage">
      <Explication nombre={nombre} />
      <Alerte message={erreur} onFermer={() => setErreur(null)} />
      {reglage ? <Option reglage={reglage} occupe={occupe} onBasculer={(actif) => void basculer(actif)} /> : null}
    </div>
  );
}
