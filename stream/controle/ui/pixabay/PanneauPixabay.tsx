/**
 * Onglet Pixabay : chercher des fonds, les mettre de côté, les rapatrier.
 *
 * Même grille que les autres onglets — le travail à gauche, ce qui l'accompagne à droite —
 * sinon la page ne ressemble à aucune autre du centre de contrôle.
 *
 * Tant qu'aucune clé n'est enregistrée, seul le mode d'emploi est monté : chercher sans clé
 * ne donnerait qu'un refus de Pixabay, dont l'utilisateur ne saurait rien faire.
 *
 * Un fond téléchargé arrive dans le corpus, qui EST l'explorateur de la composition : il
 * apparaît aussitôt dans la liste des fonds de l'onglet Scène, sans rien d'autre à faire.
 */
import { useState, type ReactNode } from "react";
import type { Media } from "../../pixabay/types.ts";
import { Alerte } from "../commun/composants.tsx";
import { Apercu } from "./Apercu.tsx";
import { Cle } from "./Cle.tsx";
import { BarreRecherche, Grille, Pages } from "./Resultats.tsx";
import { usePixabay } from "./usePixabay.ts";

/**
 * Le média ouvert vient des listes : le relire à chaque rendu le garde à jour quand on le met
 * en favori ou qu'on le télécharge sans refermer l'aperçu. Sans ça, la modale continuerait
 * d'afficher « Télécharger » sur un fichier déjà pris.
 */
function mediaAJour(ouvert: Media | null, listes: Media[][]): Media | null {
  if (!ouvert) return null;
  const trouve = listes.flat()
    .find((m) => m.id === ouvert.id && m.genre === ouvert.genre);
  return trouve ?? ouvert;
}

/** Les trois gestes possibles sur un média, passés tels quels aux deux grilles. */
interface Gestes {
  onOuvrir: (media: Media) => void;
  onFavori: (media: Media) => void;
  onTelecharger: (media: Media) => void;
}

export function PanneauPixabay(): ReactNode {
  const p = usePixabay();
  const [ouvert, setOuvert] = useState<Media | null>(null);
  const avis = <Alerte message={p.erreur} onFermer={p.effacerErreur} />;

  if (p.etat?.cleEnregistree !== true) {
    return (
      <div className="pixabay-accueil">
        {avis}
        <Cle etat={p.etat} onEnregistrer={p.enregistrerCle} onOublier={p.oublierCle} />
      </div>
    );
  }
  const gestes = {
    onOuvrir: setOuvert,
    onFavori: (m: Media) => void p.basculerFavori(m),
    onTelecharger: (m: Media) => void p.telecharger(m),
  };
  return (
    <div className="pixabay">
      <Travail p={p} avis={avis} gestes={gestes} />
      <Cote p={p} gestes={gestes} />
      <Apercu media={mediaAJour(ouvert, [p.resultats, p.favoris])} occupe={p.occupe}
        onFermer={() => setOuvert(null)}
        onFavori={gestes.onFavori} onTelecharger={gestes.onTelecharger} />
    </div>
  );
}

interface PropsColonne {
  p: ReturnType<typeof usePixabay>;
  gestes: Gestes;
  avis?: ReactNode;
}

/** La colonne de travail : on cherche, on regarde, on prend. */
function Travail({ p, avis, gestes }: PropsColonne): ReactNode {
  return (
    <div className="colonne">
      {avis}
      <BarreRecherche occupe={p.occupe} onChercher={(q, g, n) => void p.chercher(q, g, n)} />
      <Grille titre="Résultats" medias={p.resultats} occupe={p.occupe} {...gestes}
        compte={p.total > 0 ? `${p.total} sur Pixabay` : undefined}
        vide="Lance une recherche pour voir ce que Pixabay propose."
        pied={<Pages page={p.page} pages={p.pages} occupe={p.occupe}
          onPage={(n) => void p.allerPage(n)} />} />
    </div>
  );
}

/** La colonne d'à-côté : ce qu'on a mis de réserve, et la clé qui rend tout ça possible. */
function Cote({ p, gestes }: PropsColonne): ReactNode {
  return (
    <div className="colonne">
      <Grille titre="Favoris" medias={p.favoris} occupe={p.occupe} {...gestes}
        compte={p.favoris.length > 0 ? `${p.favoris.length} de côté` : undefined}
        vide="Rien de côté. L'étoile d'un résultat le garde ici sans le télécharger." />
      <Cle etat={p.etat} onEnregistrer={p.enregistrerCle} onOublier={p.oublierCle} />
    </div>
  );
}
