/**
 * Rediffusions archivées de la chaîne. La suppression est définitive côté Twitch :
 * elle passe par une confirmation, comme les autres suppressions du centre de contrôle.
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { Rediffusion } from "../../twitch/types.ts";
import { Alerte, BoutonIcone, Section, Vide } from "../commun/composants.tsx";
import { Icone } from "../commun/Icones.tsx";
import { dateLisible, messageErreur } from "../commun/format.ts";
import { apiTwitch } from "./api-twitch.ts";
import { dureeRediffusion, nombreLisible } from "./format-twitch.ts";
import { Archivage } from "./Archivage.tsx";

function Ligne({ video, occupe, onSupprimer }: {
  video: Rediffusion; occupe: boolean; onSupprimer: () => void;
}): ReactNode {
  const duree = dureeRediffusion(video.duree);
  const titre = video.titre || "(sans titre)";
  return (
    <div className="rediffusion">
      <span className="titre" title={titre}>{titre}</span>
      <span className="date">{dateLisible(video.publieeLe)}</span>
      <span className="mono t-xs fg-1">
        {duree}{duree ? " · " : ""}{nombreLisible(video.vues)} vues
      </span>
      <span className="ligne">
        {video.url
          ? <a className="btn sm icone" href={video.url} target="_blank" rel="noreferrer"
              title="Ouvrir sur Twitch" aria-label="Ouvrir sur Twitch">
              <Icone nom="externe" />
            </a>
          : null}
        <BoutonIcone nom="corbeille" titre="Supprimer cette rediffusion" variante="danger" taille="sm"
          desactive={occupe} onClick={onSupprimer} />
      </span>
    </div>
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
  if (liste === null) return <p className="chargement">Lecture des archives…</p>;
  if (liste.length === 0) return <Vide icone="video" message="Aucune rediffusion archivée." />;
  return (
    <>
      {liste.map((video) => (
        <Ligne key={video.id} video={video} occupe={occupe} onSupprimer={() => void supprimer(video)} />
      ))}
    </>
  );
}

function compte(liste: Rediffusion[] | null): string | undefined {
  if (liste === null) return undefined;
  return liste.length > 1 ? `${liste.length} archivées` : `${liste.length} archivée`;
}

export function Rediffusions(): ReactNode {
  const archives = useArchives();
  const actions = (
    <BoutonIcone nom="rafraichir" titre="Actualiser les rediffusions" variante="discret" taille="sm"
      onClick={() => void archives.recharger()} />
  );
  return (
    <Section titre="Rediffusions" compte={compte(archives.liste)} actions={actions}>
      <Alerte message={archives.erreur} onFermer={() => archives.setErreur(null)} />
      <Archivage nombre={archives.liste === null ? null : archives.liste.length} />
      <Liste archives={archives} />
    </Section>
  );
}
