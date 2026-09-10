/**
 * Onglet Pixabay : chercher des fonds, les mettre de côté, les rapatrier.
 *
 * Tant qu'aucune clé n'est enregistrée, seul le mode d'emploi est monté — chercher sans clé
 * ne donnerait qu'un refus de Pixabay, et l'utilisateur ne saurait pas quoi en faire.
 *
 * Un fond téléchargé arrive dans le corpus, qui EST l'explorateur de la composition : il
 * apparaît aussitôt dans la liste des fonds de l'onglet Scène, sans rien d'autre à faire.
 */
import type { ReactNode } from "react";
import { Alerte } from "../commun/composants.tsx";
import { Cle } from "./Cle.tsx";
import { BarreRecherche, Grille } from "./Resultats.tsx";
import { usePixabay } from "./usePixabay.ts";

export function PanneauPixabay(): ReactNode {
  const p = usePixabay();
  const avis = <Alerte message={p.erreur} onFermer={p.effacerErreur} />;

  if (p.etat?.cleEnregistree !== true) {
    return (
      <div className="colonne">
        {avis}
        <Cle etat={p.etat} onEnregistrer={p.enregistrerCle} onOublier={p.oublierCle} />
      </div>
    );
  }
  return (
    <div className="colonne">
      {avis}
      <BarreRecherche occupe={p.occupe} onChercher={(q, g, n) => void p.chercher(q, g, n)} />
      <Grille titre="Résultats" medias={p.resultats} total={p.total} occupe={p.occupe}
        vide="Lance une recherche pour voir ce que Pixabay propose."
        onFavori={(m) => void p.basculerFavori(m)}
        onTelecharger={(m) => void p.telecharger(m)} />
      <Grille titre="Favoris" medias={p.favoris} total={p.favoris.length} occupe={p.occupe}
        vide="Rien de côté. L'étoile d'un résultat le garde ici sans le télécharger."
        onFavori={(m) => void p.basculerFavori(m)}
        onTelecharger={(m) => void p.telecharger(m)} />
      <Cle etat={p.etat} onEnregistrer={p.enregistrerCle} onOublier={p.oublierCle} />
    </div>
  );
}
