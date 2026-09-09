/** Une rangée de la pile : visibilité, verrou, nom renommable sur place, outils, réordonnancement. */
import { useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from "react";
import type { Calque } from "../../types.ts";
import { BoutonIcone } from "../commun/composants.tsx";
import { Icone } from "../commun/Icones.tsx";
import { ICONES, libelleType, nomCalque } from "./calques.ts";

/** Gestes de glisser-déposer partagés par toutes les rangées de la pile. */
export interface GestesPile {
  glisse: string | null;
  depot: { id: string; avant: boolean } | null;
  commencer: (id: string, e: DragEvent<HTMLLIElement>) => void;
  survoler: (id: string, e: DragEvent<HTMLLIElement>) => void;
  quitter: (id: string) => void;
  deposer: (e: DragEvent<HTMLLIElement>) => void;
  terminer: () => void;
}

interface Props {
  calque: Calque;
  actif: boolean;
  verrou: boolean;
  renomme: boolean;
  gestes: GestesPile;
  onChoisir: () => void;
  onVisible: () => void;
  onVerrou: () => void;
  onDupliquer: () => void;
  onSupprimer: () => void;
  onRenommer: (nom: string) => void;
  onOuvrirRenommage: () => void;
  onFermerRenommage: () => void;
  /** 1 monte le calque d'un rang dans l'empilement, -1 le descend. */
  onDecaler: (delta: -1 | 1) => void;
}

interface SaisieProps { valeur: string; onValider: (nom: string) => void; onAnnuler: () => void; }

function SaisieNom({ valeur, onValider, onAnnuler }: SaisieProps): ReactNode {
  const [texte, setTexte] = useState(valeur);
  const fini = useRef(false);
  const valider = (): void => {
    if (fini.current) return;
    fini.current = true;
    const propre = texte.trim();
    if (propre === "" || propre === valeur) onAnnuler(); else onValider(propre);
  };
  return (
    <input
      value={texte} maxLength={60} aria-label="Nouveau nom" autoFocus spellCheck={false}
      onChange={(e) => setTexte(e.target.value)}
      onBlur={valider}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
        e.stopPropagation();
        if (e.key === "Enter") valider();
        if (e.key === "Escape") { fini.current = true; onAnnuler(); }
      }}
    />
  );
}

function classes(props: Props): string {
  const { calque, actif, verrou, gestes } = props;
  const cible = gestes.depot !== null && gestes.depot.id === calque.id ? gestes.depot : null;
  const depot = cible === null ? "" : cible.avant ? "avant" : "apres";
  return [
    "rangee", actif ? "actif" : "", calque.visible ? "" : "masque", verrou ? "verrou" : "",
    gestes.glisse === calque.id ? "glisse" : "", depot,
  ].filter(Boolean).join(" ");
}

function Outils({ onDupliquer, onSupprimer }: Pick<Props, "onDupliquer" | "onSupprimer">): ReactNode {
  return (
    <span className="rangee-outils" onClick={(e) => e.stopPropagation()}>
      <BoutonIcone nom="copier" titre="Dupliquer" taille="sm" variante="discret" onClick={onDupliquer} />
      <BoutonIcone nom="corbeille" titre="Supprimer" taille="sm" variante="danger" onClick={onSupprimer} />
      <span className="poignee-glisse" title="Glisser pour réordonner" aria-hidden="true">
        <Icone nom="poignee" />
      </span>
    </span>
  );
}

function Etats({ calque, verrou, onVisible, onVerrou }: Props): ReactNode {
  return (
    <>
      <button
        type="button" className="btn sm icone oeil" aria-pressed={!calque.visible}
        title={calque.visible ? "Masquer" : "Afficher"}
        onClick={(e) => { e.stopPropagation(); onVisible(); }}
      >
        <Icone nom={calque.visible ? "oeil" : "oeil-barre"} />
      </button>
      <button
        type="button" className="btn sm icone cadenas" aria-pressed={verrou}
        title={verrou ? "Déverrouiller ce calque" : "Verrouiller ce calque"}
        onClick={(e) => { e.stopPropagation(); onVerrou(); }}
      >
        <Icone nom={verrou ? "cadenas" : "cadenas-ouvert"} />
      </button>
    </>
  );
}

function Texte(props: Props): ReactNode {
  const { calque, renomme, onRenommer, onOuvrirRenommage, onFermerRenommage } = props;
  const boucle = calque.type === "video" && calque.boucle !== false ? " · boucle" : "";
  return (
    <span className="rangee-texte">
      <span className="icone-type"><Icone nom={ICONES[calque.type]} /></span>
      <span className="rangee-nom" onDoubleClick={onOuvrirRenommage} title="Double-clic pour renommer">
        {renomme
          ? <SaisieNom valeur={calque.nom} onValider={onRenommer} onAnnuler={onFermerRenommage} />
          : nomCalque(calque)}
      </span>
      <span className="rangee-type">{libelleType(calque.type)}{boucle}</span>
    </span>
  );
}

/** Ctrl (ou ⌘) + flèches : réordonner sans passer par le glisser-déposer. */
function surTouche(e: KeyboardEvent<HTMLLIElement>, onDecaler: (delta: -1 | 1) => void): void {
  if (!e.ctrlKey && !e.metaKey) return;
  if (e.key === "ArrowUp") { e.preventDefault(); onDecaler(1); }
  if (e.key === "ArrowDown") { e.preventDefault(); onDecaler(-1); }
}

export function RangeeCalque(props: Props): ReactNode {
  const { calque, actif, gestes, onChoisir, onDecaler } = props;
  return (
    <li
      className={classes(props)} role="option" aria-selected={actif} tabIndex={0} draggable
      onClick={onChoisir}
      onKeyDown={(e) => surTouche(e, onDecaler)}
      onDragStart={(e) => gestes.commencer(calque.id, e)}
      onDragOver={(e) => gestes.survoler(calque.id, e)}
      onDragLeave={() => gestes.quitter(calque.id)}
      onDrop={gestes.deposer}
      onDragEnd={gestes.terminer}
    >
      <Etats {...props} />
      <Texte {...props} />
      <Outils onDupliquer={props.onDupliquer} onSupprimer={props.onSupprimer} />
    </li>
  );
}
