#!/usr/bin/env python3
"""Isole la voix d'une génération et la recadre sur ce qui sonne réellement.

ACE-Step produit une vraie production : la voix arrive avec une nappe et parfois une basse.
demucs sépare les quatre pistes, on ne garde que la voix. Et le modèle ne remplit pas toujours
la durée demandée — le chant peut démarrer à trois secondes et s'arrêter cinq secondes avant la
fin. On coupe donc au premier et au dernier son réel, sinon la banque serait pleine de blancs.

demucs vient du venv de Vela : il est déjà installé, avec CUDA, et c'est le même outil que
l'explorateur utilise. Aucune raison d'en installer un second.
"""
import argparse
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np

DEMUCS = Path.home() / ".local/share/vela/demucs-venv/bin/demucs"
MODELE = "htdemucs"
# Sous ce niveau, c'est du silence ou du souffle de séparation, pas du chant.
SEUIL_DB = -45.0
# Marge gardée de part et d'autre : couper au ras de l'attaque s'entend comme un clic.
MARGE_S = 0.08


def separer(source: Path, travail: Path) -> Path:
    """Rend le chemin de la piste de voix. Lève si demucs échoue."""
    if not DEMUCS.exists():
        raise RuntimeError(f"demucs introuvable : {DEMUCS}")
    travail.mkdir(parents=True, exist_ok=True)
    try:
        resultat = subprocess.run(
            [str(DEMUCS), "-n", MODELE, "--out", str(travail), str(source)],
            capture_output=True, text=True, timeout=900,
        )
    except (OSError, subprocess.SubprocessError) as erreur:
        raise RuntimeError(f"demucs n'a pas pu être lancé : {erreur}") from erreur
    if resultat.returncode != 0:
        raise RuntimeError(f"demucs a échoué : {resultat.stderr.strip()[-300:]}")
    voix = travail / MODELE / source.stem / "vocals.wav"
    if not voix.exists():
        raise RuntimeError(f"piste de voix absente : {voix}")
    return voix


def echantillons(chemin: Path, frequence: int = 44100) -> np.ndarray:
    try:
        brut = subprocess.run(
            ["ffmpeg", "-v", "error", "-i", str(chemin), "-ac", "1", "-ar", str(frequence),
             "-f", "f32le", "-"], capture_output=True, timeout=300).stdout
    except (OSError, subprocess.SubprocessError) as erreur:
        raise RuntimeError(f"lecture impossible de {chemin} : {erreur}") from erreur
    return np.frombuffer(brut, dtype=np.float32)


def bornes_sonores(x: np.ndarray, frequence: int = 44100) -> tuple[float, float] | None:
    """Premier et dernier instant où le signal dépasse le seuil, en secondes."""
    if x.size == 0:
        return None
    fenetre = frequence // 50  # 20 ms
    reste = x.size % fenetre
    utile = x[: x.size - reste] if reste else x
    if utile.size == 0:
        return None
    niveaux = np.sqrt((utile.reshape(-1, fenetre) ** 2).mean(axis=1) + 1e-12)
    db = 20 * np.log10(niveaux)
    sonores = np.flatnonzero(db > SEUIL_DB)
    if sonores.size == 0:
        return None
    debut = max(0.0, sonores[0] * fenetre / frequence - MARGE_S)
    fin = min(x.size / frequence, (sonores[-1] + 1) * fenetre / frequence + MARGE_S)
    return (debut, fin) if fin - debut > 1.0 else None


def recadrer(voix: Path, sortie: Path, debut: float, fin: float) -> None:
    """Coupe, normalise à -20 dBFS et fond les deux extrémités sur 40 ms."""
    sortie.parent.mkdir(parents=True, exist_ok=True)
    duree = fin - debut
    filtre = (f"afade=t=in:st=0:d=0.04,afade=t=out:st={max(0.0, duree - 0.04):.3f}:d=0.04,"
              "loudnorm=I=-20:TP=-2:LRA=7")
    try:
        subprocess.run(
            ["ffmpeg", "-v", "error", "-ss", f"{debut:.3f}", "-t", f"{duree:.3f}", "-i", str(voix),
             "-af", filtre, "-ac", "2", "-ar", "44100", "-c:a", "libvorbis", "-q:a", "5",
             "-y", str(sortie)], check=True, timeout=300)
    except (OSError, subprocess.SubprocessError) as erreur:
        raise RuntimeError(f"recadrage impossible vers {sortie} : {erreur}") from erreur


def traiter(source: Path, sortie: Path, travail: Path, garder_travail: bool = False) -> dict:
    voix = separer(source, travail)
    bornes = bornes_sonores(echantillons(voix))
    if bornes is None:
        raise RuntimeError("aucun chant exploitable après séparation")
    debut, fin = bornes
    recadrer(voix, sortie, debut, fin)
    if not garder_travail:
        shutil.rmtree(travail, ignore_errors=True)
    return {"fichier": sortie.name, "debut": round(debut, 3), "fin": round(fin, 3),
            "duree": round(fin - debut, 3)}


def main() -> None:
    a = argparse.ArgumentParser(description="Isole et recadre la voix d'une génération.")
    a.add_argument("source")
    a.add_argument("sortie")
    a.add_argument("--travail", default="/tmp/vox-travail")
    a.add_argument("--garder-travail", action="store_true")
    args = a.parse_args()
    try:
        bilan = traiter(Path(args.source), Path(args.sortie), Path(args.travail),
                        args.garder_travail)
    except RuntimeError as erreur:
        print(f"échec : {erreur}", file=sys.stderr)
        sys.exit(1)
    print(f"{bilan['fichier']} · {bilan['duree']}s "
          f"(coupé de {bilan['debut']}s à {bilan['fin']}s)")


if __name__ == "__main__":
    main()
