import { BrowserWindow, ipcMain } from "electron";
import { createHudWindow } from "../hudWindow.js";
import { createAgentOverlayWindow } from "../hudWindow.js";
import { createTaskOverlayWindow } from "../taskOverlayWindow.js";
import { createMediaPlayerWindow } from "../mediaPlayerWindow.js";

let hudWindow: BrowserWindow | null = null;
let agentOverlayWindow: BrowserWindow | null = null;
let taskOverlayWindow: BrowserWindow | null = null;
let mediaPlayerWindow: BrowserWindow | null = null;

export function ipcMainEvents(mainWindow: BrowserWindow) {
  // HUD Window Events
  ipcMain.on("open-hud", () => {
    if (!hudWindow) {
      hudWindow = createHudWindow();
    }
  });

  ipcMain.on("close-hud", () => {
    if (hudWindow) {
      hudWindow.close();
      hudWindow = null;
    }
  });

  // Agent Overlay Events
  ipcMain.on("open-agent-overlay", () => {
    if (!agentOverlayWindow) {
      agentOverlayWindow = createAgentOverlayWindow();
    }
  });

  ipcMain.on("close-agent-overlay", () => {
    if (agentOverlayWindow) {
      agentOverlayWindow.close();
      agentOverlayWindow = null;
    }
  });

  // Task Overlay Events
  ipcMain.on("open-task-overlay", () => {
    if (!taskOverlayWindow) {
      taskOverlayWindow = createTaskOverlayWindow();
    }
  });

  ipcMain.on("close-task-overlay", () => {
    if (taskOverlayWindow) {
      taskOverlayWindow.close();
      taskOverlayWindow = null;
    }
  });

  ipcMain.on("show-task-overlay", () => {
    if (taskOverlayWindow) {
      taskOverlayWindow.show();
    }
  });

  ipcMain.on("hide-task-overlay", () => {
    if (taskOverlayWindow) {
      taskOverlayWindow.hide();
    }
  });

  ipcMain.on("update-task", (_event, data) => {
    if (taskOverlayWindow) {
      taskOverlayWindow.webContents.send('update-task', data);
    }
  });

  ipcMain.on("update-task-progress", (_event, progress) => {
    if (taskOverlayWindow) {
      taskOverlayWindow.webContents.send('update-progress', progress);
    }
  });

  ipcMain.on("update-task-status", (_event, status) => {
    if (taskOverlayWindow) {
      taskOverlayWindow.webContents.send('update-status', status);
    }
  });

  // Media Player Events
  ipcMain.on("open-media-player", () => {
    if (!mediaPlayerWindow) {
      mediaPlayerWindow = createMediaPlayerWindow();
    }
  });

  ipcMain.on("close-media-player", () => {
    if (mediaPlayerWindow) {
      mediaPlayerWindow.close();
      mediaPlayerWindow = null;
    }
  });

  ipcMain.on("show-media-player", () => {
    if (mediaPlayerWindow) {
      mediaPlayerWindow.show();
    }
  });

  ipcMain.on("hide-media-player", () => {
    if (mediaPlayerWindow) {
      mediaPlayerWindow.hide();
    }
  });

  ipcMain.on("update-media", (_event, data) => {
    if (mediaPlayerWindow) {
      mediaPlayerWindow.webContents.send('update-media', data);
    }
  });

  ipcMain.on("set-media-player-interactive", (_event, interactive) => {
    if (mediaPlayerWindow) {
      mediaPlayerWindow.setIgnoreMouseEvents(!interactive);
    }
  });

  // Window Control Events
  ipcMain.on("minimize-window", () => {
    mainWindow.minimize();
  });

  ipcMain.on("maximize-window", () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });

  ipcMain.on("close-window", () => {
    mainWindow.close();
  });
}
