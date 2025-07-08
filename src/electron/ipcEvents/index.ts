import { BrowserWindow, ipcMain } from "electron";
import { createAgentOverlayWindow } from "../agentOverlay.js";
import { createTaskOverlayWindow } from "../taskOverlayWindow.js";
import { createMediaPlayerWindow } from "../mediaPlayerWindow.js";
import { createHudWindow } from "../hudWindow.js";

let agentOverlay: BrowserWindow | null = null;
let taskOverlayWindow: BrowserWindow | null = null;
let mediaPlayerWindow: BrowserWindow | null = null;
let hudWindow: BrowserWindow | null = null;

export function setupIpcEvents() {
  // HUD Overlay Events
  ipcMain.on("startOverlay", () => {
    if (!hudWindow) {
      hudWindow = createHudWindow();
    }
    hudWindow.show();
  });

  ipcMain.on("stopOverlay", () => {
    if (hudWindow) {
      hudWindow.close();
      hudWindow = null;
    }
  });

  // Agent Overlay Events
  ipcMain.on("open-agent-overlay", () => {
    if (!agentOverlay) {
      agentOverlay = createAgentOverlayWindow();
    }
    agentOverlay.show();
  });

  ipcMain.on("close-agent-overlay", () => {
    if (agentOverlay) {
      agentOverlay.close();
      agentOverlay = null;
    }
  });

  // Task Overlay Events
  ipcMain.on("open-task-overlay", () => {
    if (!taskOverlayWindow) {
      taskOverlayWindow = createTaskOverlayWindow();
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
    }
    mediaPlayerWindow.show();
  });

  ipcMain.on("close-media-player", () => {
    if (mediaPlayerWindow) {
      mediaPlayerWindow.close();
      mediaPlayerWindow = null;
    }
  });
}

export function closeWindows() {
  if (agentOverlay) {
    agentOverlay.close();
    agentOverlay = null;
  }

  if (taskOverlayWindow) {
    taskOverlayWindow.close();
    taskOverlayWindow = null;
  }

  if (mediaPlayerWindow) {
    mediaPlayerWindow.close();
    mediaPlayerWindow = null;
  }

  if (hudWindow) {
    hudWindow.close();
    hudWindow = null;
  }
}
