/**
 * Un média trouvé sur Pixabay. Deux gestes possibles, et ils sont distincts :
 * le mettre de côté sans le prendre, ou le rapatrier dans le corpus.
 */
import type { ReactNode } from "react";
import type { Media } from "../../pixabay/types.ts";
import { Badge, Bouton, BoutonIcone } from "../commun/composants.tsx";
import { octetsLisibles } from "../commun/format.ts";

interface Props {
  media: Media;
  occupe: boolean;
  onFavori: (media: Media) => void;
  onTelecharger: (media: Media) => void;
}

function duree(secondes: number): string {
  if (secondes <= 0) return "";
  const m = Math.floor(secondes / 60);
  const s = secondes % 60;
  return m > 0 ? `${m} min ${String(s).padStart(2, "0")}` : `${s} s`;
}

/** L'aperçu et les deux marques posées dessus : le genre à gauche, l'état à droite. */
function Apercu({ media }: { media: Media }): ReactNode {
  return (
    <div className="pixabay-apercu">
      {media.apercu
        ? <img src={media.apercu} alt={media.tags} loading="lazy" />
        : <span className="pixabay-sans-apercu">pas d'aperçu</span>}
      {media.genre === "video" ? <span className="pixabay-genre">vidéo</span> : null}
      {media.telecharge
        ? <span className="pixabay-prise">
            <Badge sens="ok" voyant>dans la composition</Badge>
          </span>
        : null}
    </div>
  );
}

export function Vignette({ media, occupe, onFavori, onTelecharger }: Props): ReactNode {
  const legende = [
    media.genre === "video" ? duree(media.duree) : `${media.largeur}×${media.hauteur}`,
    media.octets > 0 ? octetsLisibles(media.octets) : "",
  ].filter(Boolean).join(" · ");

  return (
    <figure className={media.telecharge ? "pixabay-vignette prise" : "pixabay-vignette"}>
      <Apercu media={media} />
      <figcaption>
        <span className="pixabay-legende">{legende}</span>
        <span className="pixabay-auteur">
          {media.page
            ? <a href={media.page} target="_blank" rel="noreferrer">{media.auteur}</a>
            : media.auteur}
        </span>
      </figcaption>
      <div className="pixabay-gestes">
        <BoutonIcone nom={media.favori ? "etoile-pleine" : "etoile"} taille="sm"
          variante={media.favori ? "principal" : "discret"} presse={media.favori}
          titre={media.favori ? "Retirer des favoris" : "Garder de côté sans télécharger"}
          onClick={() => onFavori(media)} />
        <Bouton petit desactive={occupe || media.telecharge}
          onClick={() => onTelecharger(media)}>
          {media.telecharge ? "Déjà pris" : "Télécharger"}
        </Bouton>
      </div>
    </figure>
  );
}
