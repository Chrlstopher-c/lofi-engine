/**
 * Un média trouvé sur Pixabay.
 *
 * L'aperçu est un bouton : on clique pour voir en grand, parce qu'une vignette de 220 pixels
 * ne suffit pas à juger une boucle. Les deux gestes restent sous l'image, distincts — garder
 * de côté n'est pas télécharger.
 */
import type { ReactNode } from "react";
import type { Media } from "../../pixabay/types.ts";
import { Badge, Bouton, BoutonIcone } from "../commun/composants.tsx";
import { octetsLisibles } from "../commun/format.ts";

interface Props {
  media: Media;
  occupe: boolean;
  onOuvrir: (media: Media) => void;
  onFavori: (media: Media) => void;
  onTelecharger: (media: Media) => void;
}

function duree(secondes: number): string {
  if (secondes <= 0) return "";
  const m = Math.floor(secondes / 60);
  return m > 0 ? `${m} min ${String(secondes % 60).padStart(2, "0")}` : `${secondes} s`;
}

function legende(media: Media): string {
  return [
    media.genre === "video" ? duree(media.duree) : `${media.largeur}×${media.hauteur}`,
    media.octets > 0 ? octetsLisibles(media.octets) : "",
  ].filter(Boolean).join(" · ");
}

/** L'aperçu cliquable, et les deux marques posées dessus. */
function Apercu({ media, onOuvrir }: Pick<Props, "media" | "onOuvrir">): ReactNode {
  return (
    <button type="button" className="pixabay-apercu" title="Voir en grand"
      onClick={() => onOuvrir(media)}>
      {media.apercu
        ? <img src={media.apercu} alt={media.tags} loading="lazy" />
        : <span className="pixabay-sans-apercu">pas d'aperçu</span>}
      <b>{legende(media)}</b>
      {media.genre === "video" ? <i className="pixabay-genre">vidéo</i> : null}
      {media.telecharge
        ? <span className="pixabay-prise"><Badge sens="ok" voyant>prise</Badge></span>
        : null}
    </button>
  );
}

export function Vignette({ media, occupe, onOuvrir, onFavori, onTelecharger }: Props): ReactNode {
  return (
    <figure className={media.telecharge ? "pixabay-carte prise" : "pixabay-carte"}>
      <Apercu media={media} onOuvrir={onOuvrir} />
      <figcaption>
        <BoutonIcone nom={media.favori ? "etoile-pleine" : "etoile"} taille="sm"
          variante={media.favori ? "principal" : "discret"} presse={media.favori}
          titre={media.favori ? "Retirer des favoris" : "Garder de côté sans télécharger"}
          onClick={() => onFavori(media)} />
        <span className="pixabay-auteur">
          {media.page
            ? <a href={media.page} target="_blank" rel="noreferrer">{media.auteur}</a>
            : media.auteur}
        </span>
        <Bouton petit taille="sm" desactive={occupe || media.telecharge}
          titre={media.telecharge ? "Déjà dans la composition" : "Rapatrier dans la composition"}
          onClick={() => onTelecharger(media)}>
          {media.telecharge ? "Prise" : "Prendre"}
        </Bouton>
      </figcaption>
    </figure>
  );
}
