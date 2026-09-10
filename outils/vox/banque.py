#!/usr/bin/env python3
"""Fabrique la banque de nappes vocales : génération locale, isolation, recadrage, manifeste.

Deux couleurs, chacune rattachée à des types de génération du moteur. Plusieurs tonalités par
couleur, plusieurs variantes par tonalité : c'est ce qui permet au moteur de piocher sans que
l'auditeur reconnaisse l'échantillon.

Les quatre tonalités sont espacées d'une tierce mineure. N'importe laquelle des douze est donc
à un demi-ton et demi au plus de l'une d'elles : la voix se transpose de si peu qu'elle ne se
déforme pas.

Tout est local : ACE-Step (Apache 2.0) pour la matière, demucs pour n'en garder que la voix.
Aucune licence tierce ne pèse sur le résultat.
"""
import json
import os
import sys
import time
from pathlib import Path

RACINE_ACE = Path("/mnt/projects/ace-step")
sys.path.insert(0, str(RACINE_ACE))
sys.path.insert(0, str(Path(__file__).parent))

for var in ("http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY"):
    os.environ.pop(var, None)

from loguru import logger  # noqa: E402
from acestep.handler import AceStepHandler  # noqa: E402
from acestep.llm_inference import LLMHandler  # noqa: E402
from acestep.inference import GenerationParams, GenerationConfig, generate_music  # noqa: E402

from isoler import traiter  # noqa: E402

SORTIE = Path("/mnt/projects/lofi-engine/public/assets/engine/VoixSamples")
TRAVAIL = Path("/tmp/vox-banque")
DUREE = 40
VARIANTES = 3
TONALITES = ["C major", "D# major", "F# major", "A major"]
CLE_COURTE = {"C major": "do", "D# major": "mib", "F# major": "fad", "A major": "la"}
DEMI_TONS = {"C major": 0, "D# major": 3, "F# major": 6, "A major": 9}

# Les paroles réduites à une voyelle : sans elles le modèle invente des mots, et un mot dans
# une nappe de fond s'entend immédiatement.
PAROLES = "[Intro]\nAah\n\n[Verse]\nAah\nAah\nAah\nAah\n\n[Outro]\nAah"

# Le chœur mixte lointain a été essayé et écarté à l'écoute : il ne convainc pas. Restent deux
# couleurs. « Équilibré » puise dans les deux, c'est le type neutre ; « Énergique » n'a pas de
# voix du tout, son réglage la coupe déjà.
COULEURS = {
    "proche": {
        "types": ["nocturne", "equilibre"],
        "invite": "Solo female voice humming sustained aah, close and breathy, intimate, warm, "
                  "gentle vibrato, no instruments, no percussion, a cappella, lofi background pad",
    },
    "ethere": {
        "types": ["atmospherique", "equilibre"],
        "invite": "Ethereal wordless female choir, sustained aah vowels, soft and airy, distant, "
                  "heavy reverb, no instruments, no percussion, no drums, ambient vocal pad, lofi",
    },
}


def preparer():
    logger.info("chargement du modèle…")
    debut = time.time()
    dit = AceStepHandler()
    message, ok = dit.initialize_service(
        project_root=str(RACINE_ACE), config_path="acestep-v15-turbo",
        device="auto", offload_to_cpu=True)
    if not ok:
        logger.error(f"chargement impossible : {message}")
        sys.exit(1)
    llm = LLMHandler()
    _, ok_llm = llm.initialize(
        checkpoint_dir=str(RACINE_ACE / "checkpoints"), lm_model_path="acestep-5Hz-lm-0.6B",
        backend="pt", device="auto", offload_to_cpu=True, dtype=None)
    logger.info(f"prêt en {time.time() - debut:.0f}s")
    return dit, (llm if ok_llm else None)


def engendrer(dit, llm, invite, tonalite, graine, dossier):
    params = GenerationParams(
        task_type="text2music", thinking=llm is not None, caption=invite, lyrics=PAROLES,
        bpm=70, keyscale=tonalite, timesignature="4", vocal_language="en", duration=DUREE,
        inference_steps=8, guidance_scale=1.0, seed=graine)
    resultat = generate_music(dit, llm, params=params,
                              config=GenerationConfig(batch_size=1, audio_format="wav"),
                              save_dir=str(dossier))
    if not resultat.success:
        return None
    chemins = [a.get("path") for a in resultat.audios if a.get("path")]
    return Path(chemins[0]) if chemins else None


def une_nappe(dit, llm, couleur, reglage, tonalite, variante):
    nom = f"{couleur}-{CLE_COURTE[tonalite]}-{variante + 1}"
    graine = abs(hash((couleur, tonalite, variante))) % 2_000_000
    brut = engendrer(dit, llm, reglage["invite"], tonalite, graine, TRAVAIL / "brut" / nom)
    if brut is None:
        logger.error(f"{nom} : génération échouée")
        return None
    try:
        bilan = traiter(brut, SORTIE / f"{nom}.ogg", TRAVAIL / "sep" / nom)
    except RuntimeError as erreur:
        logger.error(f"{nom} : {erreur}")
        return None
    logger.info(f"{nom} · {bilan['duree']}s")
    return {"nom": nom, "couleur": couleur, "types": reglage["types"], "tonalite": tonalite,
            "demiTons": DEMI_TONS[tonalite], "graine": graine, **bilan}


def main() -> None:
    SORTIE.mkdir(parents=True, exist_ok=True)
    dit, llm = preparer()
    entrees = []
    for couleur, reglage in COULEURS.items():
        for tonalite in TONALITES:
            for variante in range(VARIANTES):
                entree = une_nappe(dit, llm, couleur, reglage, tonalite, variante)
                if entree:
                    entrees.append(entree)
    manifeste = {
        "version": 1,
        "provenance": "Généré localement par ACE-Step v1.5 (Apache 2.0), voix isolée par "
                      "demucs htdemucs. Aucune licence tierce ne pèse sur ces fichiers.",
        "nappes": entrees,
    }
    (SORTIE / "manifeste.json").write_text(
        json.dumps(manifeste, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    logger.info(f"banque écrite : {len(entrees)} nappes dans {SORTIE}")


if __name__ == "__main__":
    main()
