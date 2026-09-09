/**
 * Rediffusions archivées de la chaîne. La suppression est définitive côté Twitch :
 * elle passe par une confirmation, comme les autres suppressions du centre de contrôle.
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { Rediffusion } from "../../twitch/types.ts";
import { Alerte, Bouton, Section } from "../commun/composants.tsx";
import { dateLisible, messageErreur } from "../commun/format.ts";
import { apiTwitch } from "./api-twitch.ts";
import { dureeRediffusion, nombreLisible } from "./format-twitch.ts";

function Ligne({ video, occupe, onSupprimer }: {
  video: Rediffusion; occupe: boolean; onSupprimer: () => void;
}): ReactNode {
  const duree = dureeRediffusion(video.duree);
  return (
    <li className="rediffusion">
      <span className="rediffusion-titre" title={video.titre}>
        {video.url
          ? <a className="lien" href={video.url} target="_blank" rel="noreferrer">{video.titre || "(sans titre)"}</a>
          : (video.titre || "(sans titre)")}
      </span>
      <span className="discret">
        {dateLisible(video.publieeLe)}
        {duree ? ` · ${duree}` : ""}
        {` · ${nombreLisible(video.vues)} vues`}
      </span>
      <Bouton petit variante="discret" desactive={occupe} titre="Supprimer cette rediffusion"
        onClick={onSupprimer}>×</Bouton>
    </li>
  );
}

interface Archives {
  liste: Rediffusion[] | null;
  erreur: string | null;
  occupe: boolean;
  setErreur: (e: string | null) => void;
  recharger: () => Promise<void>;
  supprimer: (video: Rediffusion) => Promise<void>;
}

/** La liste et les deux opérations dessus ; la suppression relit toujours la liste ensuite. */
function useArchives(): Archives {
  const [liste, setListe] = useState<Rediffusion[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  const recharger = useCallback(async (): Promise<void> => {
    try {
      setListe(await apiTwitch.listerRediffusions());
      setErreur(null);
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }, []);

  useEffect(() => { void recharger(); }, [recharger]); // chargement initial

  const supprimer = async (video: Rediffusion): Promise<void> => {
    const titre = video.titre || "cette rediffusion";
    if (!window.confirm(`Supprimer « ${titre} » ? La suppression est définitive sur Twitch.`)) return;
    setOccupe(true);
    try {
      await apiTwitch.supprimerRediffusion(video.id);
      setErreur(null);
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setOccupe(false);
      await recharger();
    }
  };

  return { liste, erreur, occupe, setErreur, recharger, supprimer };
}

function Liste({ archives }: { archives: Archives }): ReactNode {
  const { liste, occupe, supprimer } = archives;
  if (liste === null) return <p className="discret chargement">Lecture des archives…</p>;
  if (liste.length === 0) return <p className="discret vide">Aucune rediffusion archivée.</p>;
  return (
    <ul className="liste-rediffusions">
      {liste.map((video) => (
        <Ligne key={video.id} video={video} occupe={occupe} onSupprimer={() => void supprimer(video)} />
      ))}
    </ul>
  );
}

export function Rediffusions(): ReactNode {
  const archives = useArchives();
  return (
    <Section titre="Rediffusions"
      actions={
        <Bouton petit variante="discret" onClick={() => void archives.recharger()}>Actualiser</Bouton>
      }>
      <Alerte message={archives.erreur} onFermer={() => archives.setErreur(null)} />
      <Liste archives={archives} />
    </Section>
  );
}
