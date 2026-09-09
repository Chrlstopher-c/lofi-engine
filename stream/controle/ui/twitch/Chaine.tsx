/**
 * Titre et catégorie du live, et état réel de la chaîne.
 * La recherche de catégorie part sur commande explicite : Twitch limite le débit, on ne
 * l'interroge pas à chaque frappe.
 */
import { useState, type ReactNode } from "react";
import type { Categorie, Chaine } from "../../twitch/types.ts";
import { Alerte, BarreEnregistrement, Bouton, Champ, Section, Texte } from "../commun/composants.tsx";
import { useEditeur } from "../commun/useEditeur.ts";
import { messageErreur } from "../commun/format.ts";
import { apiTwitch } from "./api-twitch.ts";

interface ChoixProps { categorieNom: string; onChoisir: (categorie: Categorie) => void; }

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
    <Champ libelle="Catégorie" indice={categorieNom ? `actuellement : ${categorieNom}` : "aucune catégorie définie"}>
      <span className="saisie-cle">
        <Texte valeur={recherche} onChange={setRecherche} placeholder="Chercher une catégorie…" />
        <Bouton petit desactive={occupe || recherche.trim().length < 2} onClick={() => void chercher()}>
          {occupe ? "Recherche…" : "Chercher"}
        </Bouton>
      </span>
      <Alerte message={erreur} onFermer={() => setErreur(null)} />
      <ResultatsCategories resultats={resultats} onChoisir={onChoisir} />
    </Champ>
  );
}

function ResultatsCategories({ resultats, onChoisir }: {
  resultats: Categorie[] | null; onChoisir: (c: Categorie) => void;
}): ReactNode {
  if (resultats === null) return null;
  if (resultats.length === 0) return <p className="discret vide">Aucune catégorie ne correspond.</p>;
  return (
    <ul className="twitch-categories">
      {resultats.map((categorie) => (
        <li key={categorie.id}>
          <button type="button" className="twitch-categorie" onClick={() => onChoisir(categorie)}>
            {categorie.nom}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function ChaineTwitch(): ReactNode {
  const editeur = useEditeur<Chaine>({ lire: apiTwitch.lireChaine, ecrire: apiTwitch.modifierChaine });
  const chaine = editeur.valeur;
  if (editeur.chargement && !chaine) {
    return <Section titre="Live"><p className="discret chargement">Lecture de la chaîne…</p></Section>;
  }
  if (!chaine) return <Section titre="Live"><Alerte message={editeur.erreur ?? "Chaîne indisponible."} /></Section>;

  const barre = (
    <BarreEnregistrement modifie={editeur.modifie} enregistrement={editeur.enregistrement}
      libelle="Appliquer sur Twitch"
      onAnnuler={() => void editeur.recharger()} onEnregistrer={() => void editeur.enregistrer()} />
  );

  return (
    <Section titre="Live" actions={barre}>
      <Alerte message={editeur.erreur} onFermer={editeur.effacerErreur} />
      <div className="grille-champs">
        <Champ libelle="Titre du live" indice="140 caractères au plus">
          <Texte valeur={chaine.titre} onChange={(titre) => editeur.definir((c) => ({ ...c, titre }))}
            placeholder="Titre affiché sur la chaîne" />
        </Champ>
        <ChoixCategorie categorieNom={chaine.categorieNom}
          onChoisir={(c) => editeur.definir((actuel) => ({
            ...actuel, categorieId: c.id, categorieNom: c.nom,
          }))} />
      </div>
    </Section>
  );
}
