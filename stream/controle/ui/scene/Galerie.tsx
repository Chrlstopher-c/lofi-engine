/** Images de fond disponibles : vignettes, choix, dépôt (glisser-déposer ou bouton), suppression. */
import { useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import type { ImageFond } from "../commun/api.ts";
import { urlFond } from "../commun/api.ts";
import { octetsLisibles } from "../commun/format.ts";
import { Bouton } from "../commun/composants.tsx";

interface Props {
  fonds: ImageFond[];
  choisi: string;
  occupe: boolean;
  onChoisir: (fichier: string) => void;
  onDeposer: (fichiers: File[]) => void;
  onSupprimer: (fichier: string) => void;
}

const ACCEPTE = ".png,.jpg,.jpeg,.webp,.avif";

interface VignetteProps { image: ImageFond; active: boolean; onChoisir: () => void; onSupprimer: () => void; }

/**
 * Une vidéo ne s'affiche pas dans une balise image : elle apparaîtrait cassée. On montre sa
 * première image, et on la joue au survol pour voir ce qu'elle donne avant de la choisir.
 */
function Apercu({ image }: { image: ImageFond }): ReactNode {
  if (!image.video) return <img src={urlFond(image.fichier)} alt="" loading="lazy" />;
  return (
    <video
      src={urlFond(image.fichier)} muted playsInline loop preload="metadata"
      onMouseEnter={(e) => void e.currentTarget.play().catch(() => {})}
      onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
    />
  );
}

function Vignette({ image, active, onChoisir, onSupprimer }: VignetteProps): ReactNode {
  return (
    <li className={active ? "vignette active" : "vignette"}>
      <button type="button" className="vignette-image" onClick={onChoisir} title={image.fichier}>
        <Apercu image={image} />
      </button>
      <div className="vignette-pied">
        <span className="vignette-nom" title={image.fichier}>{image.fichier}</span>
        <span className="discret mono">{octetsLisibles(image.octets)}</span>
        <button type="button" className="vignette-supprimer" onClick={onSupprimer} title="Supprimer cette image">
          ×
        </button>
      </div>
    </li>
  );
}

function VignetteVide({ active, onChoisir }: { active: boolean; onChoisir: () => void }): ReactNode {
  return (
    <li className={active ? "vignette active vignette-vide" : "vignette vignette-vide"}>
      <button type="button" className="vignette-image" onClick={onChoisir}><span>Aucun fond</span></button>
      <div className="vignette-pied"><span className="vignette-nom">Fond par défaut de la scène</span></div>
    </li>
  );
}

function ZoneDepot({ occupe, onDeposer }: { occupe: boolean; onDeposer: (f: File[]) => void }): ReactNode {
  const saisie = useRef<HTMLInputElement>(null);
  function surSelection(e: ChangeEvent<HTMLInputElement>): void {
    const fichiers = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (fichiers.length > 0) onDeposer(fichiers);
  }
  return (
    <div className="galerie-depot">
      <span className="discret">Glisser une image ici, ou</span>
      <Bouton petit desactive={occupe} onClick={() => saisie.current?.click()}>
        {occupe ? "Dépôt en cours…" : "Déposer une image"}
      </Bouton>
      <input ref={saisie} type="file" accept={ACCEPTE} multiple hidden onChange={surSelection} />
      <span className="discret">
        Images png, jpg, webp, avif, gif — 25 Mo max · Vidéos mp4, webm — 400 Mo max
      </span>
    </div>
  );
}

export function Galerie(props: Props): ReactNode {
  const { fonds, choisi, occupe, onChoisir, onDeposer, onSupprimer } = props;
  const [survol, setSurvol] = useState(false);

  function surDepot(e: DragEvent<HTMLElement>): void {
    e.preventDefault();
    setSurvol(false);
    const fichiers = Array.from(e.dataTransfer.files);
    if (fichiers.length > 0) onDeposer(fichiers);
  }

  return (
    <div
      className={survol ? "galerie depot-survol" : "galerie"}
      onDragOver={(e) => { e.preventDefault(); setSurvol(true); }}
      onDragLeave={() => setSurvol(false)}
      onDrop={surDepot}
    >
      <ul className="vignettes">
        <VignetteVide active={choisi === ""} onChoisir={() => onChoisir("")} />
        {fonds.map((image) => (
          <Vignette key={image.fichier} image={image} active={image.fichier === choisi}
            onChoisir={() => onChoisir(image.fichier)} onSupprimer={() => onSupprimer(image.fichier)} />
        ))}
      </ul>
      <ZoneDepot occupe={occupe} onDeposer={onDeposer} />
    </div>
  );
}
