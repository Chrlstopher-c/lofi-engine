/**
 * Onglet Diffusion : à gauche l'antenne et ce qui la nourrit, à droite ce qui se règle.
 * Destinations et encodage sont un seul objet côté serveur : une seule barre d'enregistrement
 * les couvre, celle du bloc Encodage.
 */
import { useCallback, useState, type ReactNode } from "react";
import type { Diffusion } from "../../types.ts";
import { api, type DiffusionEnvoyee } from "../commun/api.ts";
import { Alerte } from "../commun/composants.tsx";
import { useEditeur } from "../commun/useEditeur.ts";
import type { Etat } from "../commun/useEtat.ts";
import { AUCUNE_CLE, cleSaisie, Destinations, type Cles } from "./Destinations.tsx";
import { Encodage } from "./Encodage.tsx";
import { Journal } from "./Journal.tsx";
import { Materiel } from "./Materiel.tsx";
import { Pilotage } from "./Pilotage.tsx";
import { Services } from "./Services.tsx";

interface Props { etat: Etat; }

function preparerEnvoi(conf: Diffusion, cles: Cles): DiffusionEnvoyee {
  const corps: DiffusionEnvoyee = {
    twitchActif: conf.twitchActif, youtubeActif: conf.youtubeActif,
    twitchIngest: conf.twitchIngest, youtubeIngest: conf.youtubeIngest,
    resolution: conf.resolution, fps: conf.fps, bitrateVideo: conf.bitrateVideo, bitrateAudio: conf.bitrateAudio,
  };
  if (cles.twitch !== undefined && cles.twitch.trim() !== "") corps.twitchCle = cles.twitch;
  if (cles.youtube !== undefined && cles.youtube.trim() !== "") corps.youtubeCle = cles.youtube;
  return corps;
}

export function PanneauDiffusion({ etat }: Props): ReactNode {
  const [cles, setCles] = useState<Cles>(AUCUNE_CLE);
  const ecrire = useCallback(async (conf: Diffusion): Promise<Diffusion> => {
    const relue = await api.enregistrerDiffusion(preparerEnvoi(conf, cles));
    setCles(AUCUNE_CLE);
    return relue;
  }, [cles]);
  const editeur = useEditeur<Diffusion>({ lire: api.lireDiffusion, ecrire });
  const conf = editeur.valeur;
  const aEnregistrer = editeur.modifie || cleSaisie(cles);

  if (editeur.chargement && !conf) return <p className="chargement">Chargement de la configuration…</p>;
  if (!conf) return <Alerte message={editeur.erreur ?? "Configuration indisponible."} />;

  return (
    <div className="diffusion">
      <div className="colonne">
        <Pilotage etat={etat} modifie={aEnregistrer} />
        <Services etat={etat.etat} conf={conf} />
        {etat.etat ? <Materiel materiel={etat.etat.materiel} /> : null}
        <Journal conteneur={etat.etat?.conteneur ?? null}
          actif={etat.etat?.enMarche === true || etat.etat?.construction === true} />
      </div>
      <div className="colonne">
        <Alerte message={editeur.erreur} onFermer={editeur.effacerErreur} />
        <Destinations conf={conf} cles={cles} flux={etat.etat?.destinations ?? null}
          definir={editeur.definir} setCles={setCles} />
        <Encodage conf={conf} definir={editeur.definir} modifie={aEnregistrer}
          enregistrement={editeur.enregistrement}
          onAnnuler={() => { setCles(AUCUNE_CLE); void editeur.recharger(); }}
          onEnregistrer={() => void editeur.enregistrer()} />
      </div>
    </div>
  );
}
