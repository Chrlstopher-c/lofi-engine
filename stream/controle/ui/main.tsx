/** Point d'entrée : monte l'application dans #racine. */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import "./styles.css";

const racine = document.getElementById("racine");
if (!racine) throw new Error("élément #racine introuvable dans index.html");
createRoot(racine).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
