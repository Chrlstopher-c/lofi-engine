/**
 * L'aperçu en grand, au clic sur une vignette.
 *
 * Une vignette de 220 pixels ne suffit pas à décider : une boucle vidéo se juge en la
 * regardant tourner, une image en la voyant en entier. Le média est donc chargé ici à sa
 * vraie taille — celle qui sera téléchargée, pas une autre — et les deux gestes restent à
 * portée sans refermer.
 *
 * Bâti sur <dialog> plutôt que sur un <div> posé par-dessus : le navigateur donne alors le
 * piège de focus, la fermeture par Échap et l'inertie du fond, qu'il faudrait sinon réécrire.
 */
import { useEffect, useRef, type ReactNode } from "react";
import type { Media } from "../../pixabay/types.ts";
import { Badge, Bouton, BoutonIcone } from "../commun/composants.tsx";
import { octetsLisibles } from "../commun/format.ts";

interface Props {
  media: Media | null;
  occupe: boolean;
  onFermer: () => void;
  onFavori: (media: Media) => void;
  onTelecharger: (media: Media) => void;
}

function duree(secondes: number): string {
  if (secondes <= 0) return "";
  const m = Math.floor(secondes / 60);
  return m > 0 ? `${m} min ${String(secondes % 60).padStart(2, "0")}` : `${secondes} s`;
}

function Corps({ media }: { media: Media }): ReactNode {
  if (media.genre === "video") {
    // Muet et en boucle : c'est un fond, on juge le mouvement, pas la bande-son.
    return <video src={media.source} autoPlay loop muted playsInline controls />;
  }
  return <img src={media.source} alt={media.tags} />;
}

function Entete({ media, onFermer }: { media: Media; onFermer: () => void }): ReactNode {
  return (
    <header>
      <span className="pixabay-legende">
        {media.genre === "video" ? duree(media.duree) : `${media.largeur}×${media.hauteur}`}
        {media.octets > 0 ? ` · ${octetsLisibles(media.octets)}` : ""}
      </span>
      {media.telecharge ? <Badge sens="ok" voyant>dans la composition</Badge> : null}
      <span className="pousse" />
      <BoutonIcone nom="croix" titre="Fermer" variante="discret" onClick={onFermer} />
    </header>
  );
}

function Pied({ media, occupe, onFavori, onTelecharger }: Omit<Props, "onFermer">): ReactNode {
  if (!media) return null;
  return (
    <footer>
      <span className="pixabay-tags">{media.tags}</span>
      <span className="pousse" />
      {media.page
        ? <a className="lien" href={media.page} target="_blank" rel="noreferrer">
            {media.auteur} sur Pixabay
          </a>
        : null}
      <Bouton petit variante={media.favori ? "principal" : "secondaire"}
        onClick={() => onFavori(media)}>
        {media.favori ? "Retirer des favoris" : "Garder de côté"}
      </Bouton>
      <Bouton petit variante="principal" desactive={occupe || media.telecharge}
        onClick={() => onTelecharger(media)}>
        {media.telecharge ? "Déjà pris" : "Télécharger"}
      </Bouton>
    </footer>
  );
}

export function Apercu({ media, occupe, onFermer, onFavori, onTelecharger }: Props): ReactNode {
  const boite = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = boite.current;
    if (!d) return;
    if (media && !d.open) d.showModal();
    if (!media && d.open) d.close();
  }, [media]);

  return (
    <dialog className="pixabay-apercu-grand" ref={boite} onClose={onFermer}
      onClick={(e) => { if (e.target === boite.current) onFermer(); }}>
      {media ? (
        <>
          <Entete media={media} onFermer={onFermer} />
          <div className="pixabay-scene"><Corps media={media} /></div>
          <Pied media={media} occupe={occupe} onFavori={onFavori} onTelecharger={onTelecharger} />
        </>
      ) : null}
    </dialog>
  );
}
