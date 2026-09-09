/** Les plateformes vers lesquelles le diffuseur pousse le flux. */
import type { ReactNode } from "react";
import type { Diffusion } from "../../types.ts";
import { Section } from "../commun/composants.tsx";
import type { Editeur } from "../commun/useEditeur.ts";
import { Plateforme } from "./Plateforme.tsx";

/** Clés tapées mais pas encore envoyées ; `undefined` = on garde la clé enregistrée. */
export interface Cles { twitch: string | undefined; youtube: string | undefined; }

export const AUCUNE_CLE: Cles = { twitch: undefined, youtube: undefined };

export function cleSaisie(cles: Cles): boolean {
  return (cles.twitch ?? "").trim() !== "" || (cles.youtube ?? "").trim() !== "";
}

interface Props {
  conf: Diffusion;
  cles: Cles;
  definir: Editeur<Diffusion>["definir"];
  setCles: (cles: Cles) => void;
}

function compte(conf: Diffusion): string {
  const actives = (conf.twitchActif ? 1 : 0) + (conf.youtubeActif ? 1 : 0);
  return actives > 1 ? `${actives} actives` : `${actives} active`;
}

export function Destinations({ conf, cles, definir, setCles }: Props): ReactNode {
  return (
    <Section titre="Destinations" compte={compte(conf)}>
      <Plateforme nom="Twitch" marque="twitch" actif={conf.twitchActif} cleEnregistree={conf.twitchCle}
        ingest={conf.twitchIngest} nouvelleCle={cles.twitch}
        onActif={(twitchActif) => definir((c) => ({ ...c, twitchActif }))}
        onIngest={(twitchIngest) => definir((c) => ({ ...c, twitchIngest }))}
        onNouvelleCle={(twitch) => setCles({ ...cles, twitch })} />
      <Plateforme nom="YouTube" marque="youtube" actif={conf.youtubeActif} cleEnregistree={conf.youtubeCle}
        ingest={conf.youtubeIngest} nouvelleCle={cles.youtube}
        onActif={(youtubeActif) => definir((c) => ({ ...c, youtubeActif }))}
        onIngest={(youtubeIngest) => definir((c) => ({ ...c, youtubeIngest }))}
        onNouvelleCle={(youtube) => setCles({ ...cles, youtube })} />
    </Section>
  );
}
