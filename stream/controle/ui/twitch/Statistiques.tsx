/**
 * Statistiques de la chaîne : spectateurs, abonnés, durée, pic et moyenne, puis la courbe des
 * relevés. L'API Twitch ne garde aucun historique — celui-ci est échantillonné par le centre
 * de contrôle pendant la diffusion.
 *
 * Une valeur que Twitch ne donne pas s'affiche « — » : jamais un zéro de complaisance.
 */
import { Fragment, useCallback, useEffect, useState, type ReactNode } from "react";
import type { PointSpectateurs, StatistiquesTwitch } from "../../twitch/types.ts";
import { Alerte, BoutonIcone, Section } from "../commun/composants.tsx";
import { messageErreur } from "../commun/format.ts";
import { apiTwitch } from "./api-twitch.ts";
import { heureLisible, nombreLisible, segmentsDepuis } from "./format-twitch.ts";
import { Courbe } from "./Courbe.tsx";

const INTERVALLE_MS = 30_000;

interface MesureProps { libelle: string; valeur: ReactNode; detail?: string; sens?: "live" | "ok"; }

function Mesure({ libelle, valeur, detail, sens }: MesureProps): ReactNode {
  return (
    <div className={sens ? `mesure ${sens}` : "mesure"}>
      <span className="l">{libelle}</span>
      <span className="v">{valeur}</span>
      {detail ? <span className="d">{detail}</span> : null}
    </div>
  );
}

function nombreOuTiret(valeur: number | null): ReactNode {
  return valeur === null ? "—" : nombreLisible(valeur);
}

/** Durée du direct en cours, découpée pour que l'unité reste petite. */
function Duree({ depuis }: { depuis: string | null }): ReactNode {
  const segments = segmentsDepuis(depuis);
  if (segments.length === 0) return <>—</>;
  return (
    <>
      {segments.map((segment, rang) => (
        <Fragment key={`${rang}-${segment.unite}`}>
          {segment.valeur}{segment.unite ? <small>{segment.unite}</small> : null}
        </Fragment>
      ))}
    </>
  );
}

function dernierReleve(points: PointSpectateurs[]): string {
  const dernier = points[points.length - 1];
  const heure = dernier ? heureLisible(dernier.instant) : "";
  return heure ? `relevé ${heure}` : "";
}

function instantDuPic(points: PointSpectateurs[], pic: number | null): string {
  if (pic === null) return "";
  const trouve = points.find((point) => point.spectateurs === pic);
  const heure = trouve ? heureLisible(trouve.instant) : "";
  return heure ? `à ${heure}` : "";
}

function Mesures({ stats }: { stats: StatistiquesTwitch }): ReactNode {
  const debut = stats.depuis ? heureLisible(stats.depuis) : "";
  return (
    <div className="mesures">
      <Mesure libelle="Spectateurs" valeur={nombreOuTiret(stats.spectateurs)}
        detail={dernierReleve(stats.points)} sens={stats.enDirect ? "live" : undefined} />
      <Mesure libelle="Pic de la session" valeur={nombreOuTiret(stats.pic)}
        detail={instantDuPic(stats.points, stats.pic)} />
      <Mesure libelle="Moyenne des relevés" valeur={nombreOuTiret(stats.moyenne)}
        detail={stats.points.length > 0 ? `${stats.points.length} relevés` : ""} />
      <Mesure libelle="Abonnés" valeur={nombreOuTiret(stats.abonnes)} />
      <Mesure libelle="Durée du direct" valeur={<Duree depuis={stats.enDirect ? stats.depuis : null} />}
        detail={stats.enDirect && debut ? `depuis ${debut}` : ""} />
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
    void rafraichir(); // première lecture ; l'erreur éventuelle est déjà dans l'état
    const minuteur = window.setInterval(() => void rafraichir(), INTERVALLE_MS);
    return () => window.clearInterval(minuteur);
  }, [rafraichir]);

  return { stats, erreur, rafraichir, effacerErreur: () => setErreur(null) };
}

export function Statistiques(): ReactNode {
  const { stats, erreur, rafraichir, effacerErreur } = useStatistiques();
  const actions = (
    <BoutonIcone nom="rafraichir" titre="Actualiser les statistiques" variante="discret" taille="sm"
      onClick={() => void rafraichir()} />
  );
  return (
    <>
      <Alerte message={erreur} onFermer={effacerErreur} />
      {stats ? <Mesures stats={stats} /> : null}
      <Section titre="Audience" actions={actions}
        compte={stats ? `${stats.points.length} relevés` : undefined}>
        {stats === null ? <p className="chargement">Lecture des statistiques…</p> : null}
        {stats ? (
          <>
            <p className="section-titre">
              {stats.sessionEnCours ? "Spectateurs depuis le début du direct" : "Derniers relevés enregistrés"}
            </p>
            <Courbe points={stats.points} />
          </>
        ) : null}
      </Section>
    </>
  );
}
