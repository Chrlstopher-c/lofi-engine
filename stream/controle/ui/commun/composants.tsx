/** Briques d'interface partagées : champs, boutons, bascules, alertes, sections. */
import type { ReactNode, ChangeEvent } from "react";

interface ChampProps { libelle: string; children: ReactNode; indice?: string; }

export function Champ({ libelle, children, indice }: ChampProps): ReactNode {
  return (
    <label className="champ">
      <span className="champ-libelle">{libelle}</span>
      {children}
      {indice ? <span className="champ-indice">{indice}</span> : null}
    </label>
  );
}

interface TexteProps {
  valeur: string;
  onChange: (valeur: string) => void;
  placeholder?: string;
  type?: "text" | "password";
  mono?: boolean;
}

export function Texte({ valeur, onChange, placeholder, type = "text", mono = false }: TexteProps): ReactNode {
  return (
    <input
      className={mono ? "saisie mono" : "saisie"}
      type={type}
      value={valeur}
      placeholder={placeholder}
      spellCheck={false}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
    />
  );
}

interface NombreProps {
  valeur: number;
  onChange: (valeur: number) => void;
  min?: number;
  max?: number;
  pas?: number;
}

export function Nombre({ valeur, onChange, min, max, pas = 1 }: NombreProps): ReactNode {
  return (
    <input
      className="saisie mono"
      type="number"
      value={Number.isFinite(valeur) ? valeur : ""}
      min={min}
      max={max}
      step={pas}
      onChange={(e: ChangeEvent<HTMLInputElement>) => {
        const n = e.target.valueAsNumber;
        if (Number.isFinite(n)) onChange(n);
      }}
    />
  );
}

interface CurseurProps extends NombreProps { min: number; max: number; }

/** Curseur doublé d'une saisie numérique : réglage rapide à la souris, précis au clavier. */
export function Curseur({ valeur, onChange, min, max, pas = 0.01 }: CurseurProps): ReactNode {
  return (
    <span className="curseur">
      <input
        type="range" min={min} max={max} step={pas} value={valeur}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.valueAsNumber)}
      />
      <Nombre valeur={valeur} onChange={onChange} min={min} max={max} pas={pas} />
    </span>
  );
}

interface SelectionProps<V extends string> {
  valeur: V;
  options: ReadonlyArray<{ valeur: V; libelle: string }>;
  onChange: (valeur: V) => void;
}

export function Selection<V extends string>({ valeur, options, onChange }: SelectionProps<V>): ReactNode {
  return (
    <select
      className="saisie"
      value={valeur}
      // La valeur d'un <select> est toujours celle d'une <option> rendue, donc un V.
      onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value as V)}
    >
      {options.map((o) => <option key={o.valeur} value={o.valeur}>{o.libelle}</option>)}
    </select>
  );
}

interface BasculeProps { libelle: string; actif: boolean; onChange: (actif: boolean) => void; }

export function Bascule({ libelle, actif, onChange }: BasculeProps): ReactNode {
  return (
    <label className="bascule">
      <input type="checkbox" checked={actif} onChange={(e) => onChange(e.target.checked)} />
      <span className="bascule-piste" aria-hidden="true" />
      <span>{libelle}</span>
    </label>
  );
}

interface BoutonProps {
  children: ReactNode;
  onClick: () => void;
  variante?: "principal" | "secondaire" | "danger" | "discret";
  desactive?: boolean;
  titre?: string;
  petit?: boolean;
}

export function Bouton(props: BoutonProps): ReactNode {
  const { children, onClick, variante = "secondaire", desactive = false, titre, petit = false } = props;
  const classes = ["bouton", variante, petit ? "petit" : ""].filter(Boolean).join(" ");
  return (
    <button type="button" className={classes} onClick={onClick} disabled={desactive} title={titre}>
      {children}
    </button>
  );
}

interface AlerteProps { message: string | null; onFermer?: () => void; niveau?: "erreur" | "info"; }

export function Alerte({ message, onFermer, niveau = "erreur" }: AlerteProps): ReactNode {
  if (!message) return null;
  return (
    <div className={`alerte ${niveau}`} role={niveau === "erreur" ? "alert" : "status"}>
      <span>{message}</span>
      {onFermer
        ? <button type="button" className="alerte-fermer" onClick={onFermer} aria-label="Fermer">×</button>
        : null}
    </div>
  );
}

interface SectionProps { titre: string; children: ReactNode; actions?: ReactNode; classe?: string; }

export function Section({ titre, children, actions, classe }: SectionProps): ReactNode {
  return (
    <section className={classe ? `section ${classe}` : "section"}>
      <header className="section-entete">
        <h2>{titre}</h2>
        {actions ? <div className="section-actions">{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}

interface BarreEnregistrementProps {
  modifie: boolean;
  enregistrement: boolean;
  libelle: string;
  onAnnuler: () => void;
  onEnregistrer: () => void;
}

/** Indicateur de changements non enregistrés + Annuler + Enregistrer. */
export function BarreEnregistrement(props: BarreEnregistrementProps): ReactNode {
  const { modifie, enregistrement, libelle, onAnnuler, onEnregistrer } = props;
  const inactif = !modifie || enregistrement;
  return (
    <div className="barre-enregistrement">
      <span className={modifie ? "etiquette attention" : "etiquette"}>
        {modifie ? "Changements non enregistrés" : "À jour"}
      </span>
      <Bouton variante="discret" desactive={inactif} onClick={onAnnuler}>Annuler</Bouton>
      <Bouton variante="principal" desactive={inactif} onClick={onEnregistrer}>
        {enregistrement ? "Enregistrement…" : libelle}
      </Bouton>
    </div>
  );
}
