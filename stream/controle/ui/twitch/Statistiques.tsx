/**
 * Statistiques de la chaîne : spectateurs, abonnés, durée, pic et moyenne, plus la courbe
 * des relevés. L'API Twitch ne garde aucun historique — celui-ci est échantillonné par le
 * centre de contrôle, une mesure par minute pendant la diffusion.
 *
 * Une valeur que Twitch ne donne pas ne s'affiche pas : aucune case n'est remplie d'un zéro.
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { StatistiquesTwitch } from "../../twitch/types.ts";
import { Alerte, Bouton, Section } from "../commun/composants.tsx";
import { dureeDepuis, messageErreur } from "../commun/format.ts";
import { apiTwitch } from "./api-twitch.ts";
import { nombreLisible } from "./format-twitch.ts";
import { Courbe } from "./Courbe.tsx";

const INTERVALLE_MS = 30_000;

function Mesure({ libelle, valeur }: { libelle: string; valeur: string | null }): ReactNode {
  if (valeur === null) return null;
  return (
    <div className="mesure">
      <span className="mesure-libelle">{libelle}</span>
      <span className="mesure-valeur mono">{valeur}</span>
    </div>
  );
}

function Mesures({ stats }: { stats: StatistiquesTwitch }): ReactNode {
  const duree = stats.enDirect ? dureeDepuis(stats.depuis) : "";
  return (
    <div className="mesures">
      <Mesure libelle="Spectateurs" valeur={stats.spectateurs === null ? null : nombreLisible(stats.spectateurs)} />
      <Mesure libelle="Abonnés" valeur={stats.abonnes === null ? null : nombreLisible(stats.abonnes)} />
      <Mesure libelle="Durée du direct" valeur={duree.length > 0 ? duree : null} />
      <Mesure libelle="Pic de la session" valeur={stats.pic === null ? null : nombreLisible(stats.pic)} />
      <Mesure libelle="Moyenne des relevés" valeur={stats.moyenne === null ? null : nombreLisible(stats.moyenne)} />
    </div>
  );
}

interface Lecture {
  stats: StatistiquesTwitch | null;
  erreur: string | null;
  rafraichir: () => Promise<void>;
  effacerErreur: () => void;
}

function useStatistiques(): Lecture {
  const [stats, setStats] = useState<StatistiquesTwitch | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const rafraichir = useCallback(async (): Promise<void> => {
    try {
      setStats(await apiTwitch.lireStatistiques());
      setErreur(null);
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }, []);

  useEffect(() => {
    void rafraichir();
    const minuteur = window.setInterval(() => void rafraichir(), INTERVALLE_MS);
    return () => window.clearInterval(minuteur);
  }, [rafraichir]);

  return { stats, erreur, rafraichir, effacerErreur: () => setErreur(null) };
}

export function Statistiques(): ReactNode {
  const { stats, erreur, rafraichir, effacerErreur } = useStatistiques();
  const actions = <Bouton petit variante="discret" onClick={() => void rafraichir()}>Actualiser</Bouton>;
  return (
    <Section titre="Statistiques" actions={actions}>
      <Alerte message={erreur} onFermer={effacerErreur} />
      {stats === null ? <p className="discret chargement">Lecture des statistiques…</p> : null}
      {stats ? <Mesures stats={stats} /> : null}
      {stats ? (
        <>
          <p className="sous-titre">
            {stats.sessionEnCours ? "Spectateurs depuis le début du direct" : "Derniers relevés enregistrés"}
          </p>
          <Courbe points={stats.points} />
        </>
      ) : null}
    </Section>
  );
}
