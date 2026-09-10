/** Briques d'interface partagées : champs, boutons, bascules, avis, panneaux. */
import type { ReactNode, ChangeEvent } from "react";
import { Icone, type NomIcone } from "./Icones.tsx";

/* ------------------------------------------------------------------ CHAMP */

interface ChampProps {
  libelle: string;
  children: ReactNode;
  /** Aide affichée sous le contrôle. */
  indice?: string;
  /** Repère aligné à droite du libellé (unité, borne, compteur). */
  note?: string;
  erreur?: boolean;
  modifie?: boolean;
}

export function Champ({ libelle, children, indice, note, erreur = false, modifie = false }: ChampProps): ReactNode {
  const classes = ["champ", erreur ? "erreur" : "", modifie ? "modifie" : ""].filter(Boolean).join(" ");
  return (
    <label className={classes}>
      <span className="libelle">
        <span>{libelle}</span>
        {note ? <span className="indice">{note}</span> : null}
      </span>
      {children}
      {indice ? <span className="aide">{indice}</span> : null}
    </label>
  );
}

/* --------------------------------------------------------------- SAISIES */

interface TexteProps {
  valeur: string;
  onChange: (valeur: string) => void;
  placeholder?: string;
  type?: "text" | "password" | "search";
  mono?: boolean;
  desactive?: boolean;
  lectureSeule?: boolean;
  petit?: boolean;
  /** Appelé sur Entrée : une recherche se valide au clavier, pas à la souris. */
  onEntree?: () => void;
}

function classesCtrl(mono: boolean, petit: boolean): string {
  return ["ctrl", mono ? "mono" : "", petit ? "sm" : ""].filter(Boolean).join(" ");
}

export function Texte(props: TexteProps): ReactNode {
  const { valeur, onChange, placeholder, type = "text", mono = false } = props;
  const { desactive = false, lectureSeule = false, petit = false, onEntree } = props;
  return (
    <input
      className={classesCtrl(mono, petit)}
      type={type}
      value={valeur}
      placeholder={placeholder}
      spellCheck={false}
      disabled={desactive}
      readOnly={lectureSeule}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      onKeyDown={onEntree ? (e) => { if (e.key === "Enter") onEntree(); } : undefined}
    />
  );
}

interface NombreProps {
  valeur: number;
  onChange: (valeur: number) => void;
  min?: number;
  max?: number;
  pas?: number;
  unite?: string;
  desactive?: boolean;
}

export function Nombre({ valeur, onChange, min, max, pas = 1, unite, desactive = false }: NombreProps): ReactNode {
  const champ = (
    <input
      className="ctrl mono"
      type="number"
      value={Number.isFinite(valeur) ? valeur : ""}
      min={min}
      max={max}
      step={pas}
      disabled={desactive}
      onChange={(e: ChangeEvent<HTMLInputElement>) => {
        const n = e.target.valueAsNumber;
        if (Number.isFinite(n)) onChange(n);
      }}
    />
  );
  if (!unite) return <span className="nombre">{champ}</span>;
  return (
    <span className="nombre avec-unite">
      {champ}
      <span className="unite">{unite}</span>
    </span>
  );
}

interface CurseurProps extends NombreProps { min: number; max: number; }

/** Curseur doublé d'une saisie numérique : réglage rapide à la souris, précis au clavier. */
export function Curseur(props: CurseurProps): ReactNode {
  const { valeur, onChange, min, max, pas = 0.01, unite, desactive = false } = props;
  return (
    <span className="curseur">
      <input
        type="range" min={min} max={max} step={pas} value={valeur} disabled={desactive}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.valueAsNumber)}
      />
      <Nombre valeur={valeur} onChange={onChange} min={min} max={max} pas={pas} unite={unite} desactive={desactive} />
    </span>
  );
}

interface SelectionProps<V extends string> {
  valeur: V;
  options: ReadonlyArray<{ valeur: V; libelle: string }>;
  onChange: (valeur: V) => void;
  desactive?: boolean;
  petit?: boolean;
}

export function Selection<V extends string>(props: SelectionProps<V>): ReactNode {
  const { valeur, options, onChange, desactive = false, petit = false } = props;
  return (
    <select
      className={classesCtrl(false, petit)}
      value={valeur}
      disabled={desactive}
      // La valeur d'un <select> est toujours celle d'une <option> rendue, donc un V.
      onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value as V)}
    >
      {options.map((o) => <option key={o.valeur} value={o.valeur}>{o.libelle}</option>)}
    </select>
  );
}

interface BasculeProps {
  libelle: string;
  actif: boolean;
  onChange: (actif: boolean) => void;
  description?: string;
  desactive?: boolean;
  petit?: boolean;
}

export function Bascule(props: BasculeProps): ReactNode {
  const { libelle, actif, onChange, description, desactive = false, petit = false } = props;
  return (
    <label className={petit ? "bascule sm" : "bascule"}>
      <input type="checkbox" checked={actif} disabled={desactive} onChange={(e) => onChange(e.target.checked)} />
      <span className="piste" aria-hidden="true" />
      {description
        ? <span className="libelle-inline">{libelle}<small>{description}</small></span>
        : <span>{libelle}</span>}
    </label>
  );
}

/* --------------------------------------------------------------- BOUTONS */

type VarianteBouton = "principal" | "secondaire" | "danger" | "discret" | "direct";

interface BoutonProps {
  children: ReactNode;
  onClick: () => void;
  variante?: VarianteBouton;
  desactive?: boolean;
  titre?: string;
  petit?: boolean;
  taille?: "sm" | "md" | "lg";
  /** Bouton carré ne portant qu'une icône ; `titre` sert alors de libellé accessible. */
  icone?: boolean;
  /** Danger plein : action destructrice confirmée. */
  plein?: boolean;
  /** Action en cours : le libellé cède la place à l'anneau, le bouton n'est plus cliquable. */
  encours?: boolean;
  /** État à deux positions (aria-pressed). */
  presse?: boolean;
}

const VARIANTES: Readonly<Record<VarianteBouton, string>> = {
  principal: "primaire",
  secondaire: "",
  danger: "danger",
  discret: "discret",
  direct: "direct",
};

function classesBouton(props: BoutonProps): string {
  const { variante = "secondaire", petit = false, taille, icone = false, plein = false, encours = false } = props;
  const hauteur = taille ?? (petit ? "sm" : "md");
  return [
    "btn",
    VARIANTES[variante],
    hauteur === "md" ? "" : hauteur,
    icone ? "icone" : "",
    plein ? "plein" : "",
    encours ? "encours" : "",
  ].filter(Boolean).join(" ");
}

export function Bouton(props: BoutonProps): ReactNode {
  const { children, onClick, desactive = false, titre, encours = false, presse, icone = false } = props;
  return (
    <button
      type="button"
      className={classesBouton(props)}
      onClick={onClick}
      disabled={desactive || encours}
      title={titre}
      aria-label={icone ? titre : undefined}
      aria-pressed={presse}
    >
      <span className="contenu-btn">{children}</span>
    </button>
  );
}

interface BoutonIconeProps extends Omit<BoutonProps, "children"> { nom: NomIcone; titre: string; }

/** Raccourci du cas le plus fréquent : un bouton carré portant une icône du sprite. */
export function BoutonIcone({ nom, ...reste }: BoutonIconeProps): ReactNode {
  return <Bouton {...reste} icone><Icone nom={nom} /></Bouton>;
}

/* ---------------------------------------------------- ONGLETS ET SEGMENTS */

interface SegmentsProps<V extends string> {
  valeur: V;
  options: ReadonlyArray<{ valeur: V; libelle: string; pastille?: boolean }>;
  onChange: (valeur: V) => void;
  /** Libellé du groupe pour les lecteurs d'écran. */
  etiquette: string;
  /** Onglets d'une page (role=tablist) plutôt qu'un simple groupe de modes. */
  onglets?: boolean;
  petit?: boolean;
}

export function Segments<V extends string>(props: SegmentsProps<V>): ReactNode {
  const { valeur, options, onChange, etiquette, onglets = false, petit = false } = props;
  return (
    <div className={petit ? "segments sm" : "segments"} role={onglets ? "tablist" : "group"} aria-label={etiquette}>
      {options.map((o) => (
        <button
          key={o.valeur}
          type="button"
          className="segment"
          role={onglets ? "tab" : undefined}
          aria-selected={onglets ? o.valeur === valeur : undefined}
          aria-pressed={onglets ? undefined : o.valeur === valeur}
          onClick={() => onChange(o.valeur)}
        >
          {o.libelle}
          {o.pastille ? <i className="pastille" aria-hidden="true" /> : null}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------- ÉTATS ET AVIS */

type Sens = "neutre" | "ok" | "warn" | "live" | "danger" | "accent";

export function Voyant({ sens = "neutre" }: { sens?: Sens }): ReactNode {
  return <i className={sens === "neutre" ? "voyant" : `voyant ${sens}`} aria-hidden="true" />;
}

interface BadgeProps { children: ReactNode; sens?: Sens; voyant?: boolean; }

export function Badge({ children, sens = "neutre", voyant = false }: BadgeProps): ReactNode {
  return (
    <span className={sens === "neutre" ? "badge" : `badge ${sens}`}>
      {voyant ? <Voyant sens={sens} /> : null}
      {children}
    </span>
  );
}

interface VideProps { message: string; icone?: NomIcone; action?: ReactNode; }

/** État vide : ce qui manque, et le geste qui le comble. */
export function Vide({ message, icone = "info", action }: VideProps): ReactNode {
  return (
    <div className="vide">
      <Icone nom={icone} />
      <span>{message}</span>
      {action}
    </div>
  );
}

type NiveauAvis = "erreur" | "info" | "attention";

interface AlerteProps { message: string | null; onFermer?: () => void; niveau?: NiveauAvis; }

const AVIS: Readonly<Record<NiveauAvis, { classe: string; icone: NomIcone }>> = {
  erreur: { classe: "danger", icone: "alerte" },
  attention: { classe: "warn", icone: "alerte" },
  info: { classe: "info", icone: "info" },
};

export function Alerte({ message, onFermer, niveau = "erreur" }: AlerteProps): ReactNode {
  if (!message) return null;
  const { classe, icone } = AVIS[niveau];
  return (
    <div className={`avis ${classe}`} role={niveau === "erreur" ? "alert" : "status"}>
      <Icone nom={icone} />
      <span>{message}</span>
      {onFermer
        ? <BoutonIcone nom="croix" titre="Fermer" variante="discret" taille="sm" onClick={onFermer} />
        : null}
    </div>
  );
}

/* -------------------------------------------------------------- PANNEAUX */

interface SectionProps {
  titre: string;
  children: ReactNode;
  actions?: ReactNode;
  classe?: string;
  /** Compteur en mono à côté du titre (« 12 fichiers »). */
  compte?: string;
  /** Corps sans marge intérieure : listes et piles qui portent leur propre densité. */
  serre?: boolean;
  pied?: ReactNode;
}

export function Section({ titre, children, actions, classe, compte, serre = false, pied }: SectionProps): ReactNode {
  return (
    <section className={classe ? `panneau ${classe}` : "panneau"}>
      <header className="panneau-tete">
        <h2>{titre}</h2>
        {compte ? <span className="compte">{compte}</span> : null}
        {actions ? <div className="outils">{actions}</div> : null}
      </header>
      <div className={serre ? "panneau-corps serre" : "panneau-corps"}>{children}</div>
      {pied ? <div className="panneau-pied">{pied}</div> : null}
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
      <Badge sens={modifie ? "warn" : "ok"} voyant>
        {modifie ? "Non enregistré" : "À jour"}
      </Badge>
      <Bouton variante="discret" desactive={inactif} onClick={onAnnuler}>Annuler</Bouton>
      <Bouton variante="principal" desactive={!modifie} encours={enregistrement} onClick={onEnregistrer}>
        {libelle}
      </Bouton>
    </div>
  );
}
