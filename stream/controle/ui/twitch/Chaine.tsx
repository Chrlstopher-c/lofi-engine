/**
 * Titre et catégorie du direct, et à côté ce que Twitch en dit réellement.
 * La recherche de catégorie part sur commande explicite : Twitch limite le débit, on ne
 * l'interroge pas à chaque frappe.
 */
import { useState, type ReactNode } from "react";
import type { Categorie, Chaine } from "../../twitch/types.ts";
import { Alerte, Badge, BarreEnregistrement, Bouton, Champ, Section, Texte } from "../commun/composants.tsx";
import { useEditeur, type Editeur } from "../commun/useEditeur.ts";
import { messageErreur } from "../commun/format.ts";
import { apiTwitch } from "./api-twitch.ts";
import { Constat, useDirect } from "./Direct.tsx";

const TITRE_MAX = 140;

interface ChoixProps { categorieNom: string; onChoisir: (categorie: Categorie) => void; }

function Resultats({ resultats, onChoisir }: {
  resultats: Categorie[] | null; onChoisir: (categorie: Categorie) => void;
}): ReactNode {
  if (resultats === null) return null;
  if (resultats.length === 0) return <span className="aide">Aucune catégorie ne correspond.</span>;
  return (
    <span className="ligne retour">
      {resultats.map((categorie) => (
        <Bouton key={categorie.id} petit onClick={() => onChoisir(categorie)}>{categorie.nom}</Bouton>
      ))}
    </span>
  );
}

function ChoixCategorie({ categorieNom, onChoisir }: ChoixProps): ReactNode {
  const [recherche, setRecherche] = useState("");
  const [resultats, setResultats] = useState<Categorie[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  const chercher = async (): Promise<void> => {
    setOccupe(true);
    try {
      setResultats(await apiTwitch.chercherCategories(recherche));
      setErreur(null);
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setOccupe(false);
    }
  };

  return (
    <Champ libelle="Catégorie" note={categorieNom || "aucune"}
      indice="Chercher, puis choisir dans la liste rendue par Twitch.">
      <span className="ligne">
        <Texte valeur={recherche} onChange={setRecherche} placeholder="Chercher une catégorie…" />
        <Bouton petit desactive={occupe || recherche.trim().length < 2} encours={occupe}
          onClick={() => void chercher()}>Chercher</Bouton>
      </span>
      <Alerte message={erreur} onFermer={() => setErreur(null)} />
      <Resultats resultats={resultats} onChoisir={onChoisir} />
    </Champ>
  );
}

/** Ce qui s'édite : le titre et la catégorie, appliqués sur Twitch en une fois. */
function Formulaire({ chaine, editeur }: { chaine: Chaine; editeur: Editeur<Chaine> }): ReactNode {
  const trop = chaine.titre.length > TITRE_MAX;
  return (
    <>
      <Champ libelle="Titre du direct" note={`${chaine.titre.length} / ${TITRE_MAX}`} erreur={trop}
        indice={trop ? `Twitch refusera au-delà de ${TITRE_MAX} caractères.` : undefined}>
        <Texte valeur={chaine.titre} onChange={(titre) => editeur.definir((c) => ({ ...c, titre }))}
          placeholder="Titre affiché sur la chaîne" />
      </Champ>
      <ChoixCategorie categorieNom={chaine.categorieNom}
        onChoisir={(c) => editeur.definir((actuel) => ({ ...actuel, categorieId: c.id, categorieNom: c.nom }))} />
      <div className="ligne fin">
        <BarreEnregistrement modifie={editeur.modifie} enregistrement={editeur.enregistrement}
          libelle="Appliquer sur Twitch"
          onAnnuler={() => void editeur.recharger()} onEnregistrer={() => void editeur.enregistrer()} />
      </div>
    </>
  );
}

export function ChaineTwitch(): ReactNode {
  const editeur = useEditeur<Chaine>({ lire: apiTwitch.lireChaine, ecrire: apiTwitch.modifierChaine });
  const { direct } = useDirect();
  const chaine = editeur.valeur;
  const enDirect = direct?.enDirect === true;
  const badge = <Badge sens={enDirect ? "live" : "neutre"} voyant>{enDirect ? "en direct" : "hors ligne"}</Badge>;

  if (!chaine) {
    return (
      <Section titre="Chaîne" actions={badge}>
        {editeur.chargement
          ? <p className="chargement">Lecture de la chaîne…</p>
          : <Alerte message={editeur.erreur ?? "Chaîne indisponible."} />}
      </Section>
    );
  }

  return (
    <Section titre="Chaîne" actions={badge}>
      <Alerte message={editeur.erreur} onFermer={editeur.effacerErreur} />
      <Formulaire chaine={chaine} editeur={editeur} />
      <p className="section-titre">Constaté sur la chaîne</p>
      <Constat direct={direct} langue={chaine.langue} />
    </Section>
  );
}
