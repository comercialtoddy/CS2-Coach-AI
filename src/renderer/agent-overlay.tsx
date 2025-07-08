import React from "react";
import ReactDOM from "react-dom/client";
import { AgentOverlay } from "../UI/pages/AgentOverlay/AgentOverlay";
import "../UI/global.css";
import { ThemesProvider } from "../UI/context";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemesProvider>
      <AgentOverlay />
    </ThemesProvider>
  </React.StrictMode>
); 