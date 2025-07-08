import { BrowserWindow, ipcMain } from "electron";
import { createHudWindow } from "../hudWindow.js";
import { createAgentOverlayWindow } from "../hudWindow.js";
import { createTaskOverlayWindow } from "../taskOverlayWindow.js";

let hudWindow: BrowserWindow | null = null;
let agentOverlayWindow: BrowserWindow | null = null;
let taskOverlayWindow: BrowserWindow | null = null;

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
