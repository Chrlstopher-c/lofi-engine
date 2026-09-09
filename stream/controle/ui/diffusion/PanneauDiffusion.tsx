/** Onglet Diffusion : plateformes et clés, encodage, pilotage. */
import { useCallback, useState, type ReactNode } from "react";
import type { Diffusion } from "../../types.ts";
import { api, type DiffusionEnvoyee } from "../commun/api.ts";
import { Alerte, BarreEnregistrement, Champ, Section, Selection, Texte } from "../commun/composants.tsx";
import { useEditeur, type Editeur } from "../commun/useEditeur.ts";
import type { Etat } from "../commun/useEtat.ts";
import { Plateforme } from "./Plateforme.tsx";
import { Pilotage } from "./Pilotage.tsx";

interface Props { etat: Etat; }

/** Clés tapées mais pas encore envoyées ; `undefined` = on garde la clé enregistrée. */
interface Cles { twitch: string | undefined; youtube: string | undefined; }

const AUCUNE_CLE: Cles = { twitch: undefined, youtube: undefined };
const FPS = [24, 25, 30, 48, 50, 60].map((n) => ({ valeur: String(n), libelle: `${n} i/s` }));

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

function cleSaisie(cles: Cles): boolean {
  return (cles.twitch ?? "").trim() !== "" || (cles.youtube ?? "").trim() !== "";
}

interface PlateformesProps {
  conf: Diffusion;
  cles: Cles;
  definir: Editeur<Diffusion>["definir"];
  setCles: (c: Cles) => void;
}

function Plateformes({ conf, cles, definir, setCles }: PlateformesProps): ReactNode {
  return (
    <div className="plateformes">
      <Plateforme nom="Twitch" actif={conf.twitchActif} cleEnregistree={conf.twitchCle} ingest={conf.twitchIngest}
        nouvelleCle={cles.twitch}
        onActif={(twitchActif) => definir((c) => ({ ...c, twitchActif }))}
        onIngest={(twitchIngest) => definir((c) => ({ ...c, twitchIngest }))}
        onNouvelleCle={(twitch) => setCles({ ...cles, twitch })} />
      <Plateforme nom="YouTube" actif={conf.youtubeActif} cleEnregistree={conf.youtubeCle} ingest={conf.youtubeIngest}
        nouvelleCle={cles.youtube}
        onActif={(youtubeActif) => definir((c) => ({ ...c, youtubeActif }))}
        onIngest={(youtubeIngest) => definir((c) => ({ ...c, youtubeIngest }))}
        onNouvelleCle={(youtube) => setCles({ ...cles, youtube })} />
    </div>
  );
}

function Encodage({ conf, definir }: { conf: Diffusion; definir: Editeur<Diffusion>["definir"] }): ReactNode {
  return (
    <div className="grille-champs quatre-colonnes">
      <Champ libelle="Résolution" indice="largeur×hauteur, ex. 1920x1080">
        <Texte mono valeur={conf.resolution} onChange={(resolution) => definir((c) => ({ ...c, resolution }))} />
      </Champ>
      <Champ libelle="Images par seconde">
        <Selection valeur={String(conf.fps)} options={FPS}
          onChange={(v) => definir((c) => ({ ...c, fps: Number(v) }))} />
      </Champ>
      <Champ libelle="Débit vidéo" indice="ex. 1500k">
        <Texte mono valeur={conf.bitrateVideo} onChange={(bitrateVideo) => definir((c) => ({ ...c, bitrateVideo }))} />
      </Champ>
      <Champ libelle="Débit audio" indice="ex. 160k">
        <Texte mono valeur={conf.bitrateAudio} onChange={(bitrateAudio) => definir((c) => ({ ...c, bitrateAudio }))} />
      </Champ>
    </div>
  );
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

  if (editeur.chargement && !conf) return <p className="discret chargement">Chargement de la configuration…</p>;
  if (!conf) return <Alerte message={editeur.erreur ?? "Configuration indisponible."} />;

  const barre = (
    <BarreEnregistrement modifie={aEnregistrer} enregistrement={editeur.enregistrement}
      libelle="Enregistrer la diffusion"
      onAnnuler={() => { setCles(AUCUNE_CLE); void editeur.recharger(); }}
      onEnregistrer={() => void editeur.enregistrer()} />
  );

  return (
    <div className="panneau-diffusion">
      <Alerte message={editeur.erreur} onFermer={editeur.effacerErreur} />
      <Section titre="Plateformes" actions={barre}>
        <Plateformes conf={conf} cles={cles} definir={editeur.definir} setCles={setCles} />
      </Section>
      <Section titre="Encodage"><Encodage conf={conf} definir={editeur.definir} /></Section>
      <Section titre="Pilotage"><Pilotage etat={etat} modifie={aEnregistrer} /></Section>
    </div>
  );
}
