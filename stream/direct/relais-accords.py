#!/usr/bin/env python3
"""Recopie la progression d'accords du site vers un fichier que ffmpeg relit à chaque image.

Les accords naissent dans le navigateur : lui seul les connaît. La page les dépose sur le
serveur du site, cette boucle les met à disposition de drawtext. Sans elle, le calque des
accords forcerait le retour au navigateur pour toute la scène.

En Python et non en boucle shell : l'image n'a ni curl ni wget, et un processus qui dure
coûte moins que deux lancements par seconde.
"""
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

BASE = os.environ.get("LOFI_BASE", "http://lofi-engine:4707").rstrip("/")
FICHIER = Path(os.environ.get("FICHIER_ACCORDS", "/tmp/lofi-accords.txt"))
CADENCE_S = float(os.environ.get("CADENCE_ACCORDS", "0.5"))
DELAI_S = 2.0
# Ce que drawtext dessinera : au-delà, quelque chose ne va pas en amont, on n'écrit rien.
LONGUEUR_MAX = 120


def lire() -> str | None:
    """La ligne courante, ou None si le site ne répond pas ou répond n'importe quoi."""
    try:
        with urllib.request.urlopen(f"{BASE}/progression", timeout=DELAI_S) as reponse:
            if reponse.status != 200:
                return None
            ligne = reponse.read(LONGUEUR_MAX * 4).decode("utf-8", "replace").strip()
    except (urllib.error.URLError, OSError, ValueError):
        return None
    return ligne if len(ligne) <= LONGUEUR_MAX else None


def ecrire(ligne: str) -> None:
    """Écriture atomique : ffmpeg relit ce fichier en continu, il ne doit jamais le voir à moitié."""
    partiel = FICHIER.with_suffix(FICHIER.suffix + ".partiel")
    try:
        partiel.write_text(ligne, encoding="utf-8")
        partiel.replace(FICHIER)
    except OSError as erreur:
        print(f"accords non écrits : {erreur}", file=sys.stderr, flush=True)


def main() -> None:
    dernier = None
    while True:
        ligne = lire()
        if ligne is not None and ligne != dernier:
            ecrire(ligne)
            dernier = ligne
        time.sleep(CADENCE_S)


if __name__ == "__main__":
    main()
