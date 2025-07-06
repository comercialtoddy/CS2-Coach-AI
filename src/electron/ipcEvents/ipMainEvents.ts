import { BrowserWindow, shell } from "electron";
import {
  ipcMainHandle,
  ipcMainOn,
  openHudsDirectory,
} from "../helpers/index.js";
import { createHudWindow, createAgentOverlayWindow } from "../hudWindow.js";
import { getPlayers } from "../server/services/index.js";
// Handle expects a response
export function ipcMainEvents(mainWindow: BrowserWindow) {
  // Store references to overlay windows
  let agentOverlayWindow: BrowserWindow | null = null;

  ipcMainHandle("getPlayers", async () => {
    const players = await getPlayers();
    return players;
  });

  ipcMainOn("sendFrameAction", (payload) => {
    switch (payload) {
      case "CLOSE":
        mainWindow.close();
        break;
      case "MINIMIZE":
        mainWindow.minimize();
        break;
      case "MAXIMIZE":
        mainWindow.maximize();
        break;
      case "CONSOLE":
        mainWindow.webContents.toggleDevTools();
        break;
      case "RESET":
        mainWindow.unmaximize();
        break;
    }
  });

  // Game HUD overlay (existing functionality)
  ipcMainOn("startOverlay", () => {
    const hudWindow = createHudWindow();
    hudWindow.show();
  });

  // Agent AI Overlay controls
  ipcMainOn("startAgentOverlay", () => {
    if (!agentOverlayWindow || agentOverlayWindow.isDestroyed()) {
      agentOverlayWindow = createAgentOverlayWindow();
      
      // Handle window closed event
      agentOverlayWindow.on('closed', () => {
        agentOverlayWindow = null;
      });
      
      // Navigate to agent overlay route after window is ready
      agentOverlayWindow.webContents.once('did-finish-load', () => {
        agentOverlayWindow?.webContents.executeJavaScript(`
          window.location.hash = '#/agent-overlay';
        `);
      });
    }
    
    agentOverlayWindow.show();
  });

  ipcMainOn("stopAgentOverlay", () => {
    if (agentOverlayWindow && !agentOverlayWindow.isDestroyed()) {
      agentOverlayWindow.hide();
    }
  });

  ipcMainOn("updateAgentStatus", (status) => {
    if (agentOverlayWindow && !agentOverlayWindow.isDestroyed()) {
      agentOverlayWindow.webContents.send("agent-status-update", status);
    }
  });

  ipcMainOn("openExternalLink", (url) => {
    shell.openExternal(url);
  });

  ipcMainOn("openHudsDirectory", () => {
    openHudsDirectory();
  });
}
