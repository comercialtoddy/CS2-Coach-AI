import { BrowserWindow, shell } from "electron";
import {
  ipcMainHandle,
  ipcMainOn,
  openHudsDirectory,
} from "../helpers/index.js";
import { createHudWindow, createAgentOverlayWindow } from "../hudWindow.js";
import { getPlayers } from "../server/services/index.js";

console.log('Setting up IPC main events...');

// Handle expects a response
export function ipcMainEvents(mainWindow: BrowserWindow) {
  console.log('IPC main events initialized with main window:', !!mainWindow);

  // Store references to overlay windows
  let agentOverlayWindow: BrowserWindow | null = null;

  ipcMainHandle("getPlayers", async () => {
    const players = await getPlayers();
    return players;
  });

  ipcMainOn("sendFrameAction", (payload) => {
    console.log('Received sendFrameAction:', payload);
    if (!mainWindow) return;
    switch (payload) {
      case "close":
        mainWindow.close();
        break;
      case "minimize":
        mainWindow.minimize();
        break;
      case "maximize":
        if (mainWindow.isMaximized()) {
          mainWindow.unmaximize();
        } else {
          mainWindow.maximize();
        }
        break;
      default:
        break;
    }
  });

  // Game HUD overlay (existing functionality)
  ipcMainOn("startOverlay", () => {
    console.log('Received startOverlay event');
    const hudWindow = createHudWindow();
    hudWindow.show();
  });

  // Agent AI Overlay controls
  ipcMainOn("startAgentOverlay", () => {
    console.log('Received startAgentOverlay event');
    try {
      if (!agentOverlayWindow || agentOverlayWindow.isDestroyed()) {
        console.log('Creating new agent overlay window');
        agentOverlayWindow = createAgentOverlayWindow();
        
        // Handle window closed event
        agentOverlayWindow.on('closed', () => {
          console.log('Agent overlay window closed');
          agentOverlayWindow = null;
        });
        
        // Navigate to agent overlay route after window is ready
        agentOverlayWindow.webContents.once('did-finish-load', () => {
          console.log('Agent overlay window loaded, navigating to agent-overlay');
          if (!agentOverlayWindow) return;

          // Usar hash para navegação
          agentOverlayWindow.webContents.executeJavaScript(`
            window.location.hash = '#/agent-overlay';
          `).catch(error => {
            console.error('Error executing JavaScript in agent overlay window:', error);
          });
        });

        // Debug window state
        agentOverlayWindow.on('show', () => console.log('Agent overlay window shown'));
        agentOverlayWindow.on('hide', () => console.log('Agent overlay window hidden'));
      }
      
      console.log('Showing agent overlay window');
      agentOverlayWindow.show();
      agentOverlayWindow.moveTop();
      console.log('Agent overlay window bounds:', agentOverlayWindow.getBounds());
    } catch (error) {
      console.error('Error in startAgentOverlay:', error);
    }
  });

  ipcMainOn("stopAgentOverlay", () => {
    console.log('Received stopAgentOverlay event');
    if (agentOverlayWindow && !agentOverlayWindow.isDestroyed()) {
      console.log('Hiding agent overlay window');
      agentOverlayWindow.hide();
    }
  });

  ipcMainOn("updateAgentStatus", (status) => {
    console.log('Received updateAgentStatus:', status);
    if (agentOverlayWindow && !agentOverlayWindow.isDestroyed()) {
      agentOverlayWindow.webContents.send("agent-status-update", status);
    }
  });

  ipcMainOn("openExternalLink", (url) => {
    console.log('Received openExternalLink:', url);
    shell.openExternal(url);
  });

  ipcMainOn("openHudsDirectory", () => {
    console.log('Received openHudsDirectory event');
    openHudsDirectory();
  });

  console.log('All IPC main events registered');
}
