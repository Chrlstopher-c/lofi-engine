#!/usr/bin/env python3
"""
Traduit la scène (corpus/scene.json) en arguments ffmpeg : entrées et chaîne de filtres.

La scène était jusqu'ici affichée par un navigateur dont on capturait l'écran ; ffmpeg la
compose maintenant lui-même, ce qui divise la charge par deux. Le navigateur reste, réduit
à ce que lui seul sait faire : produire la musique.

Sortie : un argument par ligne sur la sortie standard, à lire avec `mapfile` côté bash.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path

DOSSIER_FONDS = Path(os.environ.get("CORPUS_DIR", "/corpus"))
POLICES = Path(os.environ.get("POLICES_DIR", "/usr/local/share/lofi-polices"))
POLICE_TITRE = POLICES / "scene-titre.ttf"
POLICE_TEXTE = POLICES / "scene-texte.ttf"
VOILE_PNG = Path("/tmp/lofi-voile.png")
FICHIER_DATE = Path(os.environ.get("FICHIER_DATE", "/tmp/lofi-date.txt"))
# Déposé par le relais : la progression que le moteur joue, relue à chaque image.
FICHIER_ACCORDS = Path(os.environ.get("FICHIER_ACCORDS", ""))

EXTENSIONS_VIDEO = {".mp4", ".webm", ".mov", ".mkv", ".m4v"}
AMPLITUDE_DERIVE = 1.06        # la scène agrandit le fond de 6 % pour avoir de quoi dériver
PERIODE_X, PERIODE_Y = 240, 300   # secondes : une dérive lente, jamais synchrone sur les deux axes

TEINTES = {"nuit": (10, 12, 16), "ambre": (26, 18, 10), "brume": (18, 20, 24)}


class SceneInvalide(Exception):
    """La scène ne décrit pas quelque chose que ffmpeg puisse composer."""


@dataclass
class Plan:
    """Ce qu'il faut passer à ffmpeg : des entrées, des filtres, et le nom du flux final."""
    base: int = 0                   # index de l'entrée du fond ; le diffuseur en ouvre avant
    entrees: list[str] = field(default_factory=list)
    filtres: list[str] = field(default_factory=list)
    dernier: str = "[fond]"
    _index: int = -1

    def __post_init__(self) -> None:
        self._index = self.base

    def ajouter_entree(self, *args: str) -> int:
        self.entrees.extend(args)
        self._index += 1
        return self._index          # le fond occupe `base`, les entrées suivantes le suivent

    def enchainer(self, filtre: str, sortie: str) -> None:
        self.filtres.append(f"{self.dernier}{filtre}[{sortie}]")
        self.dernier = f"[{sortie}]"


def est_video(fichier: str) -> bool:
    return Path(fichier).suffix.lower() in EXTENSIONS_VIDEO


def chemin_media(fichier: str) -> Path:
    """Un nom de fichier vit dans le corpus ; un chemin absolu est pris tel quel."""
    chemin = Path(fichier) if fichier.startswith("/") else DOSSIER_FONDS / fichier
    if not chemin.is_file():
        raise SceneInvalide(f"média introuvable : {chemin}")
    return chemin


def echapper(texte: str) -> str:
    """drawtext relit sa propre syntaxe : tout ce qui la structure doit être neutralisé."""
    for avant, apres in (("\\", "\\\\"), (":", "\\:"), ("'", "’"), ("%", "\\%")):
        texte = texte.replace(avant, apres)
    return texte.replace("\n", "\\n")


def couleur_ffmpeg(hex_couleur: str | None, opacite: float) -> str:
    c = (hex_couleur or "#ffffff").lstrip("#")
    if len(c) in (3, 4):
        c = "".join(ch * 2 for ch in c)
    return f"0x{c[:6]}@{max(0.0, min(1.0, opacite)):.3f}"


# --- Placement ------------------------------------------------------------------------

def _parts_ancre(ancre: str) -> tuple[str, str]:
    return ("centre", "centre") if ancre == "centre" else tuple(ancre.split("-", 1))  # type: ignore[return-value]


def position(ancre: str, x: float, y: float, larg: int, haut: int, mesure: str,
             marge: int = 0) -> tuple[str, str]:
    """
    Traduit une ancre et un décalage en pourcentage vers les expressions x/y de ffmpeg.
    `mesure` nomme la largeur et la hauteur de l'objet posé : « tw »/« th » pour du texte,
    « w »/« h » pour une incrustation — les deux familles de filtres ne les nomment pas pareil.
    """
    lo, ha = ("tw", "th") if mesure == "texte" else ("w", "h")
    vert, horiz = _parts_ancre(ancre)
    # Un cadre déborde du texte de l'épaisseur de sa bordure : sans la retrancher, il touche
    # le bord de l'image là où la scène laisse une marge.
    dx, dy = x * larg / 100.0 + marge, y * haut / 100.0 + marge

    if horiz == "gauche":
        expr_x = f"{dx:.0f}"
    elif horiz == "droite":
        expr_x = f"W-{lo}-{dx:.0f}"
    else:
        expr_x = f"(W-{lo})/2+{dx:.0f}"

    if vert == "haut":
        expr_y = f"{dy:.0f}"
    elif vert == "bas":
        expr_y = f"H-{ha}-{dy:.0f}"
    else:
        expr_y = f"(H-{ha})/2+{dy:.0f}"
    return expr_x, expr_y


# --- Fond -----------------------------------------------------------------------------

def poser_fond(plan: Plan, fond: dict, larg: int, haut: int, fps: int) -> None:
    fichier = fond.get("fichier") or ""
    if not fichier:
        raise SceneInvalide("la scène n'a pas de fond")
    chemin = chemin_media(fichier)

    if est_video(fichier):
        plan.entrees.extend(["-stream_loop", "-1", "-i", str(chemin)])
    else:
        plan.entrees.extend(["-loop", "1", "-framerate", str(fps), "-i", str(chemin)])

    # Un seul redimensionnement : on agrandit directement à la taille qu'exige la dérive,
    # puis on recadre. Passer par deux mises à l'échelle doublait le coût, mesuré.
    if fond.get("mouvement", True):
        gl, gh = int(larg * AMPLITUDE_DERIVE), int(haut * AMPLITUDE_DERIVE)
        dx, dy = f"(iw-{larg})/2", f"(ih-{haut})/2"
        cadrage = (
            f"scale={gl}:{gh}:force_original_aspect_ratio=increase,"
            f"crop={larg}:{haut}:x='{dx}+{dx}*sin(2*PI*t/{PERIODE_X})'"
            f":y='{dy}+{dy}*cos(2*PI*t/{PERIODE_Y})'"
        )
    elif fond.get("ajustement") == "contain":
        cadrage = (f"scale={larg}:{haut}:force_original_aspect_ratio=decrease,"
                   f"pad={larg}:{haut}:(ow-iw)/2:(oh-ih)/2:color=black")
    else:
        cadrage = f"scale={larg}:{haut}:force_original_aspect_ratio=increase,crop={larg}:{haut}"

    # setsar=1 n'est pas décoratif : le rapport de pixel de la source TRAVERSE scale et crop.
    # Un fond à pixels non carrés — fréquent sur une vidéo anamorphosée — ressort alors en
    # 1920x1080 déclaré en 64:27, et la plateforme encadre l'image de noir pour la rendre à la
    # forme annoncée. Mesuré : une source 1440x1080 en SAR 4:3 donnait exactement ça.
    plan.filtres.append(f"[{plan.base}:v]{cadrage},setsar=1,format=yuv420p[fond]")
    plan.dernier = "[fond]"


# --- Voile et vignettage ----------------------------------------------------------------

def _expression_alpha(voile: float, vignettage: bool, larg: int, haut: int) -> str:
    """
    Reproduit le dégradé de la scène : sombre en bas, clair en haut, et un vignettage
    elliptique par-dessus. Calculé une seule fois dans une image transparente — le
    recalculer à chaque image coûtait 69 points de processeur, mesuré.
    """
    p = f"(({haut}-Y)/{haut})"      # 0 en bas, 1 en haut, comme le dégradé CSS
    bas, milieu, haut_v = voile * 1.4, voile * 0.5, voile * 0.2
    degrade = (
        f"if(lt({p},0.42),"
        f"{bas:.4f}+({milieu:.4f}-{bas:.4f})*{p}/0.42,"
        f"{milieu:.4f}+({haut_v:.4f}-{milieu:.4f})*({p}-0.42)/0.58)"
    )
    if not vignettage:
        return f"255*min(1,max(0,{degrade}))"
    e = f"hypot((X-{larg / 2:.0f})/{larg / 2:.0f},(Y-{haut / 2:.0f})/{haut / 2:.0f})"
    vign = f"0.55*min(1,max(0,({e}-0.5)/0.5))"
    # Le vignettage est posé au-dessus du dégradé : les deux opacités se composent.
    return f"255*min(1,max(0,{vign}+({degrade})*(1-{vign})))"


def preparer_voile(scene: dict, larg: int, haut: int) -> bool:
    fond = scene.get("fond", {})
    voile = float(fond.get("voile", 0) or 0)
    vignettage = bool(fond.get("vignettage"))
    if voile <= 0 and not vignettage:
        return False

    r, v, b = TEINTES.get(scene.get("theme", "nuit"), TEINTES["nuit"])
    alpha = _expression_alpha(voile, vignettage, larg, haut)
    commande = [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-f", "lavfi", "-i", f"color=black:s={larg}x{haut}", "-frames:v", "1",
        "-vf", f"format=rgba,geq=r={r}:g={v}:b={b}:a='{alpha}'", str(VOILE_PNG),
    ]
    try:
        subprocess.run(commande, check=True, capture_output=True, timeout=120)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as erreur:
        print(f"voile non calculé : {erreur}", file=sys.stderr)
        return False
    return True


def poser_voile(plan: Plan) -> None:
    index = plan.ajouter_entree("-loop", "1", "-framerate", "1", "-i", str(VOILE_PNG))
    plan.filtres.append(f"[{index}:v]format=yuva420p[voile]")
    plan.filtres.append(f"{plan.dernier}[voile]overlay=0:0:format=yuv420:eof_action=repeat[voile_ok]")
    plan.dernier = "[voile_ok]"


# --- Calques --------------------------------------------------------------------------

def _drawtext(texte: str, police: Path, taille: int, couleur: str,
              expr_x: str, expr_y: str, cadre: bool, fichier: Path | None = None,
              brut: bool = False) -> str:
    # Un texte tenu dans un fichier est relu à chaque image : c'est ainsi que la date passe
    # en français — ffmpeg ne connaît que la locale du système — et que le calque des accords
    # pourra suivre la musique sans redémarrer la diffusion.
    source = f"textfile={fichier}:reload=1" if fichier else f"text='{texte}'"
    options = [
        f"fontfile={police}", source, f"fontsize={taille}",
        f"fontcolor={couleur}", f"x={expr_x}", f"y={expr_y}",
        "shadowcolor=black@0.45", "shadowx=0", "shadowy=2",
    ]
    # drawtext interprète %{...} dans le texte qu'il lit. Pour un contenu qui ne vient pas
    # d'ici — les accords passent par le navigateur — cette interprétation est une brèche.
    if brut:
        options.append("expansion=none")
    if cadre:
        options += ["box=1", "boxcolor=black@0.35", f"boxborderw={max(8, taille // 4)}"]
    return "drawtext=" + ":".join(options)


def poser_texte(plan: Plan, calque: dict, larg: int, haut: int, rang: int) -> None:
    contenu = (calque.get("texte") or "").strip()
    if not contenu:
        return
    taille = max(8, int(larg * float(calque.get("taille", 3)) / 100))
    police = POLICE_TITRE if calque.get("graisse") == "legere" else POLICE_TEXTE
    couleur = couleur_ffmpeg(calque.get("couleur"), float(calque.get("opacite", 1)))
    bordure = max(8, taille // 4) if calque.get("cadre") else 0
    x, y = position(calque.get("ancre", "centre"), float(calque.get("x", 0)),
                    float(calque.get("y", 0)), larg, haut, "texte", bordure)
    plan.enchainer(_drawtext(echapper(contenu), police, taille, couleur, x, y,
                             bool(calque.get("cadre"))), f"c{rang}")


def poser_horloge(plan: Plan, calque: dict, larg: int, haut: int, rang: int) -> None:
    taille = max(10, int(larg * float(calque.get("taille", 3.2)) / 100))
    couleur = couleur_ffmpeg(calque.get("couleur"), float(calque.get("opacite", 1)))
    bordure = max(8, taille // 4) if calque.get("cadre") else 0
    x, y = position(calque.get("ancre", "haut-droite"), float(calque.get("x", 0)),
                    float(calque.get("y", 0)), larg, haut, "texte", bordure)
    heure = "%{localtime\\:%H\\\\\\:%M}"
    plan.enchainer(_drawtext(heure, POLICE_TITRE, taille, couleur, x, y,
                             bool(calque.get("cadre"))), f"c{rang}")
    if not calque.get("date") or not FICHIER_DATE.is_file():
        return
    # La date suit l'heure : un tiers de sa taille, posée juste dessous, alignée pareil.
    petite = max(8, int(taille * 0.34))
    couleur_date = couleur_ffmpeg(calque.get("couleur"), float(calque.get("opacite", 1)) * 0.66)
    dy = f"+{int(taille * 1.16)}"
    plan.enchainer(
        _drawtext("", POLICE_TEXTE, petite, couleur_date, x, f"{y}{dy}", False, FICHIER_DATE),
        f"c{rang}d")


def poser_accords(plan: Plan, calque: dict, larg: int, haut: int, rang: int) -> None:
    """La progression jouée, telle que le relais l'a déposée : « Am · i IV [v] VII »."""
    taille = max(8, int(larg * float(calque.get("taille", 2.4)) / 100))
    couleur = couleur_ffmpeg(calque.get("couleur"), float(calque.get("opacite", 1)))
    bordure = max(8, taille // 4) if calque.get("cadre") else 0
    x, y = position(calque.get("ancre", "bas-droite"), float(calque.get("x", 0)),
                    float(calque.get("y", 0)), larg, haut, "texte", bordure)
    plan.enchainer(
        _drawtext("", POLICE_TEXTE, taille, couleur, x, y,
                  bool(calque.get("cadre")), FICHIER_ACCORDS, brut=True),
        f"c{rang}")


def poser_media(plan: Plan, calque: dict, larg: int, haut: int, fps: int, rang: int) -> None:
    fichier = calque.get("fichier") or ""
    if not fichier:
        return
    chemin = chemin_media(fichier)
    suffixe = chemin.suffix.lower()

    if suffixe == ".gif":
        index = plan.ajouter_entree("-ignore_loop", "0", "-i", str(chemin))
    elif est_video(fichier) or calque.get("type") == "video":
        index = plan.ajouter_entree("-stream_loop", "-1", "-i", str(chemin))
    else:
        # Une image fixe relue à chaque image coûtait 130 points : une seule lecture suffit.
        index = plan.ajouter_entree("-loop", "1", "-framerate", "1", "-i", str(chemin))

    largeur = max(2, int(larg * float(calque.get("taille", 20)) / 100))
    opacite = max(0.0, min(1.0, float(calque.get("opacite", 1))))
    prepare = f"scale={largeur}:-2,format=yuva420p"
    if opacite < 1:
        prepare += f",colorchannelmixer=aa={opacite:.3f}"
    plan.filtres.append(f"[{index}:v]{prepare}[m{rang}]")

    x, y = position(calque.get("ancre", "centre"), float(calque.get("x", 0)),
                    float(calque.get("y", 0)), larg, haut, "media")
    boucle = "eof_action=repeat" if suffixe != ".gif" else "eof_action=repeat"
    plan.filtres.append(
        f"{plan.dernier}[m{rang}]overlay=x={x}:y={y}:format=yuv420:{boucle}[c{rang}]")
    plan.dernier = f"[c{rang}]"


POSEURS = {"texte": poser_texte, "horloge": poser_horloge, "accords": poser_accords}
# Sans relais alimenté, les accords ne sont pas composables : seul le navigateur les connaît.
NON_COMPOSABLES = set() if FICHIER_ACCORDS.name else {"accords"}


def poser_calques(plan: Plan, calques: list[dict], larg: int, haut: int, fps: int) -> bool:
    """Rend vrai si toute la scène a pu être composée, faux s'il a fallu en laisser."""
    complet = True
    for rang, calque in enumerate(calques):
        if not calque.get("visible", True):
            continue
        type_calque = calque.get("type", "")
        if type_calque in NON_COMPOSABLES:
            print(f"calque « {calque.get('nom', type_calque)} » ignoré : {type_calque} "
                  "est produit par le moteur musical, que ffmpeg ne voit pas", file=sys.stderr)
            complet = False
            continue
        try:
            if type_calque in POSEURS:
                POSEURS[type_calque](plan, calque, larg, haut, rang)
            elif type_calque in ("image", "video"):
                poser_media(plan, calque, larg, haut, fps, rang)
        except SceneInvalide as erreur:
            print(f"calque « {calque.get('nom', type_calque)} » ignoré : {erreur}", file=sys.stderr)
            complet = False
    return complet


# --- Assemblage -----------------------------------------------------------------------

def composer(scene: dict, larg: int, haut: int, fps: int, base: int = 0) -> tuple[Plan, bool]:
    plan = Plan(base=base)
    poser_fond(plan, scene.get("fond", {}), larg, haut, fps)
    if preparer_voile(scene, larg, haut):
        poser_voile(plan)
    complet = poser_calques(plan, scene.get("calques", []), larg, haut, fps)
    # ffmpeg refuse un filter_complex dont la sortie n'est pas nommée explicitement.
    # Un encodeur matériel VAAPI veut en plus recevoir l'image déjà transférée sur la carte :
    # ce transfert ne peut pas vivre dans un -vf séparé, il appartient à cette chaîne.
    fin = os.environ.get("FILTRE_SORTIE", "").strip() or "null"
    plan.filtres.append(f"{plan.dernier}{fin}[v]")
    return plan, complet


def main() -> int:
    chemin_scene = Path(sys.argv[1] if len(sys.argv) > 1 else DOSSIER_FONDS / "scene.json")
    resolution = os.environ.get("STREAM_RESOLUTION", "1920x1080")
    fps = int(os.environ.get("STREAM_FPS", "30"))
    # Le diffuseur ouvre son entrée audio avant les nôtres : nos index commencent après.
    try:
        larg, haut = (int(n) for n in resolution.lower().split("x", 1))
        scene = json.loads(chemin_scene.read_text(encoding="utf-8"))
        base = int(os.environ.get("ENTREES_AVANT", "0"))
        plan, complet = composer(scene, larg, haut, fps, base)
    except (OSError, ValueError, json.JSONDecodeError, SceneInvalide) as erreur:
        print(f"scène non composable : {erreur}", file=sys.stderr)
        return 1

    for argument in plan.entrees:
        print(argument)
    print("-filter_complex")
    print(";".join(plan.filtres))
    print("-map")
    print("[v]")
    # 2 : composable, mais une partie de la scène n'y est pas. Au diffuseur de décider s'il
    # préfère la fidélité — le navigateur sait tout afficher — ou la légèreté.
    return 0 if complet else 2


if __name__ == "__main__":
    sys.exit(main())
