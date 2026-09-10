/**
 * La clé d'API Pixabay : comment l'obtenir, et où la mettre.
 *
 * Ce bloc est tout ce qu'on voit tant qu'aucune clé n'est enregistrée. Il tient le mode
 * d'emploi complet plutôt qu'un lien : personne n'a envie de chercher dans une documentation
 * en anglais où se trouve une clé qui, chez Pixabay, n'a pas de page dédiée — elle est
 * affichée au milieu de la documentation de l'API, une fois connecté.
 */
import { useState, type ReactNode } from "react";
import type { EtatPixabay } from "../../pixabay/types.ts";
import { Badge, Bouton, BoutonIcone, Champ, Section, Texte } from "../commun/composants.tsx";

const ETAPES: ReadonlyArray<{ titre: string; detail: ReactNode }> = [
  { titre: "Créer un compte Pixabay",
    detail: <>C'est gratuit et sans carte. <a href="https://pixabay.com/accounts/register/"
      target="_blank" rel="noreferrer">pixabay.com/accounts/register</a></> },
  { titre: "Ouvrir la documentation de l'API, connecté",
    detail: <>La clé s'affiche dans un encadré au début de la page, uniquement si la session
      est ouverte. <a href="https://pixabay.com/api/docs/" target="_blank"
      rel="noreferrer">pixabay.com/api/docs</a></> },
  { titre: "Recopier la clé",
    detail: <>Elle ressemble à <code>12345678-abcdef0123456789abcdef012</code> : des chiffres,
      un tiret, une longue suite hexadécimale.</> },
  { titre: "La coller ci-dessous",
    detail: <>Elle est écrite dans le <code>.env</code> du projet, qui n'est pas versionné, et
      n'est jamais réaffichée ensuite.</> },
];

interface Props {
  etat: EtatPixabay | null;
  onEnregistrer: (cle: string) => Promise<void>;
  onOublier: () => Promise<void>;
}

function ModeEmploi(): ReactNode {
  return (
    <ol className="pixabay-etapes">
      {ETAPES.map((e) => (
        <li key={e.titre}>
          <strong>{e.titre}</strong>
          <span>{e.detail}</span>
        </li>
      ))}
    </ol>
  );
}

interface PropsSaisie extends Omit<Props, "etat"> {
  enregistree: boolean;
  saisie: string;
  setSaisie: (v: string) => void;
  voir: boolean;
  setVoir: (f: (v: boolean) => boolean) => void;
}

function Saisie(p: PropsSaisie): ReactNode {
  return (
    <>
      <Champ libelle={p.enregistree ? "Remplacer la clé" : "Clé d'API"}
        indice="Écrite dans le .env du projet. Jamais réaffichée, jamais renvoyée par le serveur.">
        <span className="ligne">
          <Texte mono type={p.voir ? "text" : "password"} valeur={p.saisie} onChange={p.setSaisie}
            placeholder="12345678-abcdef0123456789abcdef012" />
          <BoutonIcone nom={p.voir ? "oeil-barre" : "oeil"} variante="discret"
            titre={p.voir ? "Masquer la clé" : "Voir la clé"} onClick={() => p.setVoir((v) => !v)} />
        </span>
      </Champ>
      <div className="ligne">
        <Bouton petit desactive={p.saisie.trim() === ""}
          onClick={() => { void p.onEnregistrer(p.saisie.trim()).then(() => p.setSaisie("")); }}>
          Enregistrer
        </Bouton>
        {p.enregistree
          ? <Bouton petit variante="discret" onClick={() => void p.onOublier()}>Retirer la clé</Bouton>
          : null}
      </div>
    </>
  );
}

export function Cle({ etat, onEnregistrer, onOublier }: Props): ReactNode {
  const [saisie, setSaisie] = useState("");
  const [voir, setVoir] = useState(false);
  const enregistree = etat?.cleEnregistree === true;

  return (
    <Section titre="Clé d'API Pixabay"
      actions={<Badge sens={enregistree ? "ok" : "warn"} voyant>
        {enregistree ? "clé enregistrée" : "aucune clé"}
      </Badge>}>
      {enregistree ? null : <ModeEmploi />}
      <Saisie enregistree={enregistree} saisie={saisie} setSaisie={setSaisie}
        voir={voir} setVoir={setVoir} onEnregistrer={onEnregistrer} onOublier={onOublier} />
      <p className="aide">
        Pixabay autorise 100 requêtes par minute, largement de quoi chercher. Sa licence
        n'exige aucun crédit et autorise l'usage commercial — chaque fichier récupéré garde
        tout de même son origine dans <code>corpus/fonds-sources.json</code>.
      </p>
    </Section>
  );
}
