#!/usr/bin/env python3
"""Extrait, dans une voix isolée, la fenêtre où elle TIENT une note.

Le modèle chante une phrase : elle monte, elle descend, elle respire. Une phrase posée sur une
musique qui a déjà sa mélodie, ça se bagarre — aucun réglage de volume n'y change rien. Ce qu'on
veut, c'est le moment où la voix ne bouge plus : c'est ça, une nappe.

On suit donc la hauteur au fil du temps et on garde la fenêtre la plus stable. Sa hauteur
mesurée part dans le manifeste : le moteur choisira l'échantillon le plus proche de la note
voulue et le transposera du minimum, plutôt que d'étirer une voix sur une octave.

Seconde passe volontairement séparée de la génération : régler la durée ou le seuil ne doit pas
coûter vingt minutes de carte graphique.
"""
import argparse
import json
import math
import subprocess
from pathlib import Path

import numpy as np

FREQUENCE = 22050
SAUT_S = 0.05
# Une voix chantée tient dans cette fourchette ; au-delà l'autocorrélation attrape une harmonique.
HAUTEUR_MIN, HAUTEUR_MAX = 130.0, 700.0
DUREE_MIN_S, DUREE_MAX_S = 4.0, 7.0
SEUIL_SILENCE = 1e-3
NOMS = ["Do", "Do#", "Ré", "Ré#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"]


def lire(chemin: Path) -> np.ndarray:
    try:
        brut = subprocess.run(
            ["ffmpeg", "-v", "error", "-i", str(chemin), "-ac", "1", "-ar", str(FREQUENCE),
             "-f", "f32le", "-"], capture_output=True, timeout=300).stdout
    except (OSError, subprocess.SubprocessError) as erreur:
        raise RuntimeError(f"lecture impossible de {chemin} : {erreur}") from erreur
    return np.frombuffer(brut, dtype=np.float32).astype(np.float64)


def suivre_hauteur(x: np.ndarray) -> np.ndarray:
    """Une hauteur en demi-tons par saut, NaN quand il n'y a rien de tonal."""
    saut = int(FREQUENCE * SAUT_S)
    fenetre = saut * 4
    bas, haut = int(FREQUENCE / HAUTEUR_MAX), int(FREQUENCE / HAUTEUR_MIN)
    sortie = []
    for depart in range(0, max(0, x.size - fenetre), saut):
        seg = x[depart:depart + fenetre]
        if np.abs(seg).max() < SEUIL_SILENCE:
            sortie.append(np.nan)
            continue
        seg = seg - seg.mean()
        corr = np.correlate(seg, seg, mode="full")[seg.size - 1:]
        pic = int(np.argmax(corr[bas:haut])) + bas
        hz = FREQUENCE / pic
        sortie.append(12 * math.log2(hz / 440.0) + 69)
    return np.array(sortie, dtype=float)


def lisser(demi_tons: np.ndarray, largeur: int = 5) -> np.ndarray:
    """Médiane glissante : l'autocorrélation saute parfois d'une octave, pas la voix."""
    if demi_tons.size < largeur:
        return demi_tons
    rembourre = np.pad(demi_tons, largeur // 2, mode="edge")
    vues = np.lib.stride_tricks.sliding_window_view(rembourre, largeur)
    return np.nanmedian(vues, axis=-1)


def meilleure_fenetre(demi_tons: np.ndarray) -> tuple[int, int, float] | None:
    """Indices de début et fin, et hauteur médiane, de la portion la plus stable."""
    pas_min = int(DUREE_MIN_S / SAUT_S)
    pas_max = int(DUREE_MAX_S / SAUT_S)
    meilleur = None
    for longueur in range(pas_max, pas_min - 1, -pas_min // 4 or 1):
        for debut in range(0, max(1, demi_tons.size - longueur)):
            tranche = demi_tons[debut:debut + longueur]
            if np.isnan(tranche).any():
                continue
            ecart = float(np.percentile(tranche, 90) - np.percentile(tranche, 10))
            if meilleur is None or ecart < meilleur[2]:
                meilleur = (debut, debut + longueur, ecart)
        if meilleur is not None and meilleur[2] < 0.6:
            break  # une variation sous un demi-ton : inutile de chercher plus court
    if meilleur is None:
        return None
    debut, fin, _ = meilleur
    return debut, fin, float(np.nanmedian(demi_tons[debut:fin]))


def nommer(demi_ton: float) -> str:
    d = int(round(demi_ton))
    return f"{NOMS[d % 12]}{d // 12 - 1}"


def extraire(source: Path, sortie: Path) -> dict | None:
    hauteurs = lisser(suivre_hauteur(lire(source)))
    trouve = meilleure_fenetre(hauteurs)
    if trouve is None:
        return None
    debut_pas, fin_pas, demi_ton = trouve
    debut, duree = debut_pas * SAUT_S, (fin_pas - debut_pas) * SAUT_S
    sortie.parent.mkdir(parents=True, exist_ok=True)
    # Fondus longs : une nappe ne commence ni ne finit, elle apparaît et s'efface.
    filtre = (f"afade=t=in:st=0:d=0.5,afade=t=out:st={max(0.0, duree - 0.6):.3f}:d=0.6,"
              "loudnorm=I=-20:TP=-2:LRA=7")
    try:
        subprocess.run(
            ["ffmpeg", "-v", "error", "-ss", f"{debut:.3f}", "-t", f"{duree:.3f}",
             "-i", str(source), "-af", filtre, "-ac", "2", "-ar", "44100",
             "-c:a", "libvorbis", "-q:a", "5", "-y", str(sortie)], check=True, timeout=300)
    except (OSError, subprocess.SubprocessError) as erreur:
        raise RuntimeError(f"extraction impossible vers {sortie} : {erreur}") from erreur
    return {"tenue": sortie.name, "hauteurDemiTon": round(demi_ton, 2),
            "hauteur": nommer(demi_ton), "tenueDebut": round(debut, 2),
            "tenueDuree": round(duree, 2)}


def main() -> None:
    a = argparse.ArgumentParser(description="Garde la partie tenue de chaque voix isolée.")
    a.add_argument("dossier", help="dossier contenant le manifeste et les voix isolées")
    args = a.parse_args()
    dossier = Path(args.dossier)
    manifeste = json.loads((dossier / "manifeste.json").read_text(encoding="utf-8"))
    gardees = []
    for nappe in manifeste["nappes"]:
        source = dossier / nappe["fichier"]
        if not source.exists():
            continue
        tenue = extraire(source, dossier / "tenues" / f"{nappe['nom']}.ogg")
        if tenue is None:
            print(f"{nappe['nom']} : aucune tenue exploitable")
            continue
        gardees.append({**nappe, **tenue})
        print(f"{nappe['nom']} · {tenue['hauteur']} · {tenue['tenueDuree']}s")
    total = len(manifeste["nappes"])
    manifeste["nappes"] = gardees
    (dossier / "manifeste.json").write_text(
        json.dumps(manifeste, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"\n{len(gardees)} tenues retenues sur {total}")


if __name__ == "__main__":
    main()
