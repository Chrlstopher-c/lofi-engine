/**
 * Les quatre choses à savoir d'un coup d'œil pendant un direct : le site produit-il l'audio,
 * le corpus de repli est-il là, qui encode, et ce que ça coûte.
 *
 * Encodeur et charge viennent du diffuseur lui-même, pas des réglages : ce qui est demandé et
 * ce qui tourne peuvent différer — un encodeur peut être inutilisable sur la machine, et la
 * définition s'abaisse d'elle-même quand il n'y a pas de puce vidéo et trop peu de cœurs.
 */
import type { ReactNode } from "react";
import type { Diffusion, EtatDiffusion, Rendu } from "../../types.ts";
import { origineScene } from "../commun/api.ts";
import { Voyant } from "../commun/composants.tsx";
import { octetsLisibles } from "../commun/format.ts";
import { chargeLisible, partDeCharge } from "./format-diffusion.ts";

interface Props { etat: EtatDiffusion | null; conf: Diffusion; }

function Service({ libelle, valeur, detail, sous }: {
  libelle: string; valeur: ReactNode; detail: string; sous?: ReactNode;
}): ReactNode {
  return (
    <div className="service">
      <span className="l">{libelle}</span>
      <span className="v">{valeur}</span>
      {sous}
      <span className="d" title={detail}>{detail}</span>
    </div>
  );
}

function corpus(etat: EtatDiffusion): string {
  const pluriel = etat.corpusFichiers > 1 ? "s" : "";
  return `${etat.corpusFichiers} fichier${pluriel}`;
}

/** Le nom court est ce qu'on lit en gros ; l'explication part dans le détail. */
function nomCourt(rendu: Rendu): string {
  return rendu.encodeurLibelle.split(" — ")[0] ?? rendu.encodeur;
}

function Encodeur({ rendu, conf }: { rendu: Rendu | null; conf: Diffusion }): ReactNode {
  if (!rendu) {
    return (
      <Service libelle="Encodage"
        valeur={`${conf.resolution} · ${conf.fps} i/s`}
        detail="réglé — l'encodeur réel se connaît une fois la diffusion lancée" />
    );
  }
  const dessine = rendu.modeScene === "ffmpeg"
    ? "scène composée par ffmpeg"
    : "scène recapturée du navigateur";
  return (
    <Service libelle="Encodeur"
      valeur={<><Voyant sens={rendu.materiel ? "ok" : "warn"} />{nomCourt(rendu)}</>}
      detail={`${rendu.encodeurLibelle} · ${dessine}`} />
  );
}

function Charge({ etat, conf }: { etat: EtatDiffusion; conf: Diffusion }): ReactNode {
  const rendu = etat.rendu;
  const coeurs = rendu?.coeurs ?? 0;
  const definition = rendu?.resolution
    ? `${rendu.resolution} · ${rendu.fps} i/s`
    : `${conf.resolution} · ${conf.fps} i/s`;
  const part = partDeCharge(etat.charge, coeurs);
  return (
    <Service libelle="Charge"
      valeur={chargeLisible(etat.charge, coeurs)}
      sous={part === null ? undefined : (
        <span className="jauge">
          <i className={part > 0.8 ? "warn" : undefined} style={{ width: `${Math.round(part * 100)}%` }} />
        </span>
      )}
      detail={`${definition} · ${conf.bitrateVideo} vidéo`} />
  );
}

export function Services({ etat, conf }: Props): ReactNode {
  const site = etat?.siteEnMarche === true;
  return (
    <div className="services-grille">
      <Service libelle="Site générateur"
        valeur={<><Voyant sens={etat ? (site ? "ok" : "danger") : "neutre"} />{site ? "Actif" : "Arrêté"}</>}
        detail={origineScene()} />
      <Service libelle="Corpus de repli"
        valeur={etat ? corpus(etat) : "…"}
        detail={etat ? `${octetsLisibles(etat.corpusOctets)} · pris si le générateur se tait` : ""} />
      <Encodeur rendu={etat?.rendu ?? null} conf={conf} />
      {etat?.enMarche === true ? <Charge etat={etat} conf={conf} /> : null}
    </div>
  );
}
