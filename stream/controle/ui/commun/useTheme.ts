/** Thème clair ou sombre : posé sur <html data-theme>, retenu dans localStorage. */
import { useCallback, useEffect, useState } from "react";

export type Theme = "sombre" | "clair";

const CLE = "lofi-theme";

function choixEnregistre(): Theme | null {
  try {
    const brut = localStorage.getItem(CLE);
    return brut === "clair" || brut === "sombre" ? brut : null;
  } catch (e) {
    console.warn("thème : localStorage illisible", e);
    return null;
  }
}

function preferenceSysteme(): Theme {
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "clair" : "sombre";
}

function retenir(theme: Theme): void {
  try {
    localStorage.setItem(CLE, theme);
  } catch (e) {
    console.warn("thème : localStorage non inscriptible, le choix vaut pour la session", e);
  }
}

export interface Basculeur {
  theme: Theme;
  basculer: () => void;
}

export function useTheme(): Basculeur {
  const [theme, setTheme] = useState<Theme>(() => choixEnregistre() ?? preferenceSysteme());

  useEffect(() => {
    document.documentElement.dataset.theme = theme === "clair" ? "light" : "dark";
  }, [theme]);

  const basculer = useCallback((): void => {
    setTheme((actuel) => {
      const suivant: Theme = actuel === "clair" ? "sombre" : "clair";
      retenir(suivant); // seul un choix explicite est retenu : sinon la préférence système reste suivie
      return suivant;
    });
  }, []);

  return { theme, basculer };
}
