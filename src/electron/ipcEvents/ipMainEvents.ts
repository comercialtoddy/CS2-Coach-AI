import { BrowserWindow, shell, app, dialog, ipcMain } from "electron";
import { createAgentOverlayWindow } from "../agentOverlay.js";
import { createTaskOverlayWindow } from "../taskOverlayWindow.js";
import { createMediaPlayerWindow } from "../mediaPlayerWindow.js";
import { getPlayers } from "../server/services/index.js";

console.log('Setting up IPC main events...');

export let agentOverlayWindow: BrowserWindow | null = null;
export let taskOverlayWindow: BrowserWindow | null = null;
export let mediaPlayerWindow: BrowserWindow | null = null;

export function setupIpcEvents() {
  // Agent Overlay Events
  ipcMain.on("start-overlay", () => {
    if (!agentOverlayWindow) {
      agentOverlayWindow = createAgentOverlayWindow();
      agentOverlayWindow.on('closed', () => (agentOverlayWindow = null));
    }
    agentOverlayWindow.show();

    if (!taskOverlayWindow) {
      taskOverlayWindow = createTaskOverlayWindow();
      taskOverlayWindow.on('closed', () => (taskOverlayWindow = null));
    }
    taskOverlayWindow.show();

    if (!mediaPlayerWindow) {
      mediaPlayerWindow = createMediaPlayerWindow();
      mediaPlayerWindow.on('closed', () => (mediaPlayerWindow = null));
    }
    mediaPlayerWindow.show();
  });

  ipcMain.on("stop-overlay", () => {
    if (agentOverlayWindow) {
      agentOverlayWindow.close();
      agentOverlayWindow = null;
    }
    if (taskOverlayWindow) {
      taskOverlayWindow.close();
      taskOverlayWindow = null;
    }
    if (mediaPlayerWindow) {
      mediaPlayerWindow.close();
      mediaPlayerWindow = null;
    }
  });

  // Task Overlay Events
  ipcMain.on("open-task-overlay", () => {
    if (!taskOverlayWindow) {
      taskOverlayWindow = createTaskOverlayWindow();
      taskOverlayWindow.on('closed', () => {
        taskOverlayWindow = null;
      });
    }
    taskOverlayWindow.show();
  });

  ipcMain.on("close-task-overlay", () => {
    if (taskOverlayWindow) {
      taskOverlayWindow.close();
      taskOverlayWindow = null;
    }
  });

  // Media Player Events
  ipcMain.on("open-media-player", () => {
    if (!mediaPlayerWindow) {
      mediaPlayerWindow = createMediaPlayerWindow();
      mediaPlayerWindow.on('closed', () => {
        mediaPlayerWindow = null;
      });
    }
    mediaPlayerWindow.show();
  });

  ipcMain.on("close-media-player", () => {
    if (mediaPlayerWindow) {
      mediaPlayerWindow.close();
      mediaPlayerWindow = null;
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
