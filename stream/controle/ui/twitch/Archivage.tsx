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
import { Icone } from "../commun/Icones.tsx";
import { dateLisible, messageErreur } from "../commun/format.ts";
import { apiTwitch } from "./api-twitch.ts";

const TABLEAU_DE_BORD = "https://dashboard.twitch.tv/settings/stream";

const INACTIVE = "Désactivée. Une fois active, toute rediffusion apparue ensuite sera effacée "
  + "définitivement sur Twitch ; celles déjà présentes restent.";

const CONFIRMATION = "Activer la suppression automatique ?\n\nToute rediffusion apparue à partir de maintenant "
  + "sera effacée définitivement sur Twitch, sans autre confirmation. Les archives déjà présentes ne seront "
  + "pas touchées.";

function constat(nombre: number | null): ReactNode {
  if (nombre === null) return null;
  if (nombre === 0) return <> Constaté sur la chaîne : <b className="ok">aucune archive</b>.</>;
  const pluriel = nombre > 1 ? "s" : "";
  return <> Constaté sur la chaîne : <b className="warn">{nombre} archive{pluriel}</b>.</>;
}

function Explication({ nombre }: { nombre: number | null }): ReactNode {
  return (
    <div className="avis info" role="status">
      <Icone nom="info" />
      <span>
        <strong>L'archivage se règle sur Twitch.</strong> « Store past broadcasts » n'est pas exposé par
        l'API : ni pour l'activer, ni pour le couper. Le réglage se trouve uniquement dans <a
          href={TABLEAU_DE_BORD} target="_blank" rel="noreferrer">les paramètres de diffusion</a>, à vérifier
        avant de lancer le direct.{constat(nombre)}
      </span>
    </div>
  );
}

function description(reglage: ReglageArchivage): string {
  if (!reglage.suppressionAuto) return INACTIVE;
  return `Active depuis le ${dateLisible(reglage.depuis)} — ${reglage.supprimees} rediffusion(s) supprimée(s). `
    + "Les archives publiées avant cette date ne sont jamais touchées.";
}

interface Reglage {
  reglage: ReglageArchivage | null;
  erreur: string | null;
  occupe: boolean;
  setErreur: (erreur: string | null) => void;
  basculer: (actif: boolean) => Promise<void>;
}

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
    <>
      <Explication nombre={nombre} />
      <Alerte message={erreur} onFermer={() => setErreur(null)} />
      {reglage
        ? <Bascule libelle="Supprimer automatiquement les nouvelles rediffusions"
            description={description(reglage)} actif={reglage.suppressionAuto} desactive={occupe}
            onChange={(actif) => void basculer(actif)} />
        : null}
      <div className="separateur" />
    </>
  );
}
