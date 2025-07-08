import { BrowserWindow, shell, app, dialog, ipcMain } from "electron";
import { createAgentOverlayWindow } from "../agentOverlay.js";
import { getPlayers } from "../server/services/index.js";

console.log('Setting up IPC main events...');

let agentOverlayWindow: BrowserWindow | null = null;

export function setupIpcEvents() {
  // Agent Overlay Events
  ipcMain.on("open-agent-overlay", () => {
    if (!agentOverlayWindow) {
      agentOverlayWindow = createAgentOverlayWindow();

      // Handle window events
      agentOverlayWindow.on('closed', () => {
        agentOverlayWindow = null;
      });

      // Wait for window to load
      agentOverlayWindow.webContents.once('did-finish-load', () => {
        console.log('Agent overlay window loaded');
      });

      // Log window events
      agentOverlayWindow.on('show', () => console.log('Agent overlay window shown'));
      agentOverlayWindow.on('hide', () => console.log('Agent overlay window hidden'));
    }

    // Show and position window
    agentOverlayWindow.show();
    agentOverlayWindow.moveTop();
    console.log('Agent overlay window bounds:', agentOverlayWindow.getBounds());
  });

  ipcMain.on("close-agent-overlay", () => {
    if (agentOverlayWindow) {
      agentOverlayWindow.close();
      agentOverlayWindow = null;
    }
  });

  ipcMain.handle("getPlayers", async () => {
    const players = await getPlayers();
    return players;
  });

  // Window Control Events
  ipcMain.on("minimize-window", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
      window.minimize();
    }
  });

  ipcMain.on("maximize-window", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
      if (window.isMaximized()) {
        window.unmaximize();
      } else {
        window.maximize();
      }
    }
  });

  ipcMain.on("close-window", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
      window.close();
    }
  });

  // External Links
  ipcMain.on("open-external-link", (_event, url: string) => {
    shell.openExternal(url);
  });

  console.log('All IPC main events registered');
}
