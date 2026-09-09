/** Fonds disponibles : recherche, filtre par nature, vignettes, choix et glisser-déposer. */
import { useState, type DragEvent, type ReactNode } from "react";
import { urlFond } from "../commun/api.ts";
import { octetsLisibles } from "../commun/format.ts";
import { Bouton, Segments, Vide } from "../commun/composants.tsx";
import { Icone } from "../commun/Icones.tsx";
import type { Media } from "./useFonds.ts";

type Filtre = "tous" | "image" | "video";

const FILTRES: ReadonlyArray<{ valeur: Filtre; libelle: string }> = [
  { valeur: "tous", libelle: "Tous" },
  { valeur: "image", libelle: "Images" },
  { valeur: "video", libelle: "Vidéos" },
];

interface Props {
  fonds: Media[];
  choisi: string;
  chargement: boolean;
  onChoisir: (fichier: string) => void;
  onDeposer: (fichiers: File[]) => void;
  onImporter: () => void;
}

/**
 * Une vidéo ne s'affiche pas dans une balise image : elle apparaîtrait cassée. On montre sa
 * première image, et on la joue au survol pour voir ce qu'elle donne avant de la choisir.
 */
function ApercuMedia({ media }: { media: Media }): ReactNode {
  if (!media.video) return <img src={urlFond(media.fichier)} alt="" loading="lazy" />;
  return (
    <video
      src={urlFond(media.fichier)} muted playsInline loop preload="metadata"
      onMouseEnter={(e) => void e.currentTarget.play().catch(() => {})}
      onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
    />
  );
}

interface VignetteProps { media: Media; active: boolean; onChoisir: () => void; }

function Vignette({ media, active, onChoisir }: VignetteProps): ReactNode {
  return (
    <button
      type="button" className="vignette" aria-pressed={active} onClick={onChoisir}
      title={`${media.fichier} — ${octetsLisibles(media.octets)}`}
    >
      <i><ApercuMedia media={media} /></i>
      {media.anime ? <em>{media.format}</em> : null}
      <b>{media.fichier}</b>
    </button>
  );
}

function retenir(fonds: Media[], terme: string, filtre: Filtre): Media[] {
  const recherche = terme.trim().toLowerCase();
  return fonds.filter((m) => {
    if (filtre === "image" && m.video) return false;
    if (filtre === "video" && !m.video) return false;
    return recherche === "" || m.fichier.toLowerCase().includes(recherche);
  });
}

interface FiltreProps {
  terme: string;
  filtre: Filtre;
  onTerme: (t: string) => void;
  onFiltre: (f: Filtre) => void;
}

function BarreFiltre({ terme, filtre, onTerme, onFiltre }: FiltreProps): ReactNode {
  return (
    <div className="galerie-filtre">
      <input
        className="ctrl" type="search" value={terme} placeholder="Rechercher un fond…"
        aria-label="Rechercher un fond" spellCheck={false}
        onChange={(e) => onTerme(e.target.value)}
      />
      <Segments valeur={filtre} options={FILTRES} onChange={onFiltre} etiquette="Filtrer les fonds" />
    </div>
  );
}

interface VignettesProps {
  retenus: Media[];
  choisi: string;
  filtree: boolean;
  onChoisir: (fichier: string) => void;
  onImporter: () => void;
}

function Vignettes({ retenus, choisi, filtree, onChoisir, onImporter }: VignettesProps): ReactNode {
  return (
    <div className="vignettes">
      {filtree ? null : (
        <button type="button" className="vignette" aria-pressed={choisi === ""}
          onClick={() => onChoisir("")} title="Fond par défaut de la scène">
          <b>Aucun fond</b>
        </button>
      )}
      {retenus.map((media) => (
        <Vignette key={media.fichier} media={media} active={media.fichier === choisi}
          onChoisir={() => onChoisir(media.fichier)} />
      ))}
      <button type="button" className="vignette ajout" onClick={onImporter}
        title="Déposer ou choisir un fichier" aria-label="Ajouter un fond">
        <Icone nom="plus" />
      </button>
    </div>
  );
}

interface EtatVideProps { filtree: boolean; onEffacer: () => void; }

function GalerieVide({ filtree, onEffacer }: EtatVideProps): ReactNode {
  return (
    <Vide
      icone={filtree ? "recherche" : "image"}
      message={filtree ? "Aucun fond ne correspond au filtre." : "Aucun fichier déposé."}
      action={filtree ? <Bouton petit onClick={onEffacer}>Effacer le filtre</Bouton> : null}
    />
  );
}

export function Galerie(props: Props): ReactNode {
  const { fonds, choisi, chargement, onChoisir, onDeposer, onImporter } = props;
  const [survol, setSurvol] = useState(false);
  const [terme, setTerme] = useState("");
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const retenus = retenir(fonds, terme, filtre);
  const filtree = terme.trim() !== "" || filtre !== "tous";
  const surDepot = (e: DragEvent<HTMLElement>): void => {
    e.preventDefault();
    setSurvol(false);
    const fichiers = Array.from(e.dataTransfer.files);
    if (fichiers.length > 0) onDeposer(fichiers);
  };
  const effacer = (): void => { setTerme(""); setFiltre("tous"); };
  return (
    <div
      className={survol ? "galerie depot-survol" : "galerie"}
      onDragOver={(e) => { e.preventDefault(); setSurvol(true); }}
      onDragLeave={() => setSurvol(false)}
      onDrop={surDepot}
    >
      <BarreFiltre terme={terme} filtre={filtre} onTerme={setTerme} onFiltre={setFiltre} />
      <Vignettes retenus={retenus} choisi={choisi} filtree={filtree}
        onChoisir={onChoisir} onImporter={onImporter} />
      {chargement || retenus.length > 0 ? null : <GalerieVide filtree={filtree} onEffacer={effacer} />}
    </div>
  );
}
