// Registre des types de calque : pour chaque type, comment créer son élément et comment lui
// appliquer un calque. Le placement (ancre, décalage, taille, couleur, opacité) est commun.
// Ajouter un type = ajouter une entrée à TYPES ici, et le style correspondant dans scene.html.
// Expose window.SCENE_CALQUES = { creer, appliquer, urlFichier }.
(function () {
  "use strict";

  // Un nom de fichier vit sous /fonds/ ; un chemin absolu (surcharge d'URL) est pris tel quel.
  function urlFichier(fichier) {
    if (!fichier) return "";
    return fichier.startsWith("/") ? fichier : "/fonds/" + encodeURIComponent(fichier);
  }

  // « #rrggbb » (ou #rgb, #rrggbbaa) → « r g b », pour rgb(var(--c) / alpha) dans le CSS.
  function triplet(hex) {
    let h = hex.slice(1);
    if (h.length === 3 || h.length === 4) h = h.split("").map((c) => c + c).join("");
    const n = parseInt(h.slice(0, 6), 16);
    if (!Number.isFinite(n)) return "";
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(" ");
  }

  // ---- Placement commun ----------------------------------------------------------------

  const ANCRES = ["haut-gauche", "haut-centre", "haut-droite", "centre", "bas-gauche", "bas-centre", "bas-droite"];

  function placer(el, calque) {
    const s = el.style;
    const [vert, horiz] = calque.ancre === "centre" ? ["centre", "centre"] : calque.ancre.split("-");
    s.top = s.bottom = s.left = s.right = "";
    if (vert === "haut") s.top = calque.y + "vh";
    else if (vert === "bas") s.bottom = calque.y + "vh";
    else s.top = "calc(50% + " + calque.y + "vh)";
    if (horiz === "gauche") s.left = calque.x + "vw";
    else if (horiz === "droite") s.right = calque.x + "vw";
    else s.left = "calc(50% + " + calque.x + "vw)";
    ANCRES.forEach((a) => el.classList.toggle("ancre-" + a, a === calque.ancre));
  }

  function styler(el, calque) {
    placer(el, calque);
    el.style.opacity = String(calque.opacite);
    const c = triplet(calque.couleur || "");
    if (c) el.style.setProperty("--c", c); else el.style.removeProperty("--c");
    if (calque.type === "image" || calque.type === "video") {
      el.style.width = calque.taille + "vw";
      el.style.fontSize = "";
    }
    else { el.style.fontSize = calque.taille + "vw"; el.style.width = ""; }
  }

  // ---- Types ---------------------------------------------------------------------------

  const TYPES = {
    texte: {
      creer() { return document.createElement("p"); },
      appliquer(el, calque) {
        if (el.textContent !== calque.texte) el.textContent = calque.texte;
        el.classList.toggle("graisse-legere", calque.graisse === "legere");
        el.classList.toggle("graisse-normale", calque.graisse !== "legere");
      },
    },

    // Le texte de l'heure est tenu par la minuterie de scene.js, pas ici.
    horloge: {
      creer() {
        const el = document.createElement("div");
        const heure = document.createElement("span");
        heure.className = "horloge-heure";
        const date = document.createElement("span");
        date.className = "horloge-date";
        el.append(heure, date);
        return el;
      },
      appliquer(el, calque) {
        el.querySelector(".horloge-date").hidden = !calque.date;
      },
    },

    // La tonalité et la progression sont tenues par la sonde de scene.js ; le calque part masqué.
    accords: {
      creer() {
        const el = document.createElement("div");
        el.hidden = true;
        const etiquette = document.createElement("span");
        etiquette.className = "accords-etiquette";
        etiquette.textContent = "Tonalité";
        const ligne = document.createElement("div");
        ligne.className = "accords-ligne";
        const cle = document.createElement("span");
        cle.className = "accords-cle";
        const liste = document.createElement("ol");
        liste.className = "accords-liste";
        ligne.append(cle, liste);
        el.append(etiquette, ligne);
        return el;
      },
      appliquer(el, calque) {
        el.classList.toggle("cadre", calque.cadre);
      },
    },

    image: {
      creer() {
        const el = document.createElement("img");
        el.alt = "";
        el.decoding = "async";
        // Image introuvable : rien à l'écran, jamais l'icône d'image cassée.
        el.addEventListener("error", () => { el.hidden = true; });
        el.addEventListener("load", () => { el.hidden = false; });
        return el;
      },
      appliquer(el, calque) {
        const url = urlFichier(calque.fichier);
        if (!url) { el.hidden = true; el.removeAttribute("src"); return; }
        if (el.getAttribute("src") !== url) el.src = url;
      },
    },

    // La vidéo est TOUJOURS muette : le stream capture le son du navigateur, une bande-son
    // ici viendrait se mélanger à la musique diffusée.
    video: {
      creer() {
        const el = document.createElement("video");
        el.muted = true;
        el.defaultMuted = true;
        el.autoplay = true;
        el.playsInline = true;
        el.preload = "auto";
        el.addEventListener("error", () => { el.hidden = true; });
        el.addEventListener("loadeddata", () => { el.hidden = false; });
        return el;
      },
      appliquer(el, calque) {
        el.loop = calque.boucle !== false;
        el.muted = true;
        const url = urlFichier(calque.fichier);
        if (!url) { el.hidden = true; el.removeAttribute("src"); return; }
        if (el.getAttribute("src") !== url) {
          el.src = url;
          // La lecture automatique peut être refusée : on réessaie, sans casser la scène.
          const lecture = el.play();
          if (lecture && typeof lecture.catch === "function") lecture.catch(() => {});
        }
      },
    },
  };

  function creer(calque) {
    const type = TYPES[calque.type];
    if (!type) return null;
    const el = type.creer();
    el.className = "calque calque-" + calque.type;
    el.dataset.id = calque.id;
    el.dataset.type = calque.type;
    return el;
  }

  function appliquer(el, calque) {
    styler(el, calque);
    TYPES[calque.type].appliquer(el, calque);
  }

  window.SCENE_CALQUES = Object.freeze({ creer, appliquer, urlFichier });
})();
