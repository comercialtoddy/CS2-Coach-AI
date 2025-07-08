import { app, BrowserWindow } from "electron";
import {
  checkDirectories,
  isDev,
  showNotification,
  getPreloadPath,
  getUIPath,
} from "./helpers/index.js";
import { shutDown, startServer } from "./server/server.js";
import { createTray } from "./tray.js";
import { createMenu } from "./menu.js";
import { createTaskOverlayWindow } from "./taskOverlayWindow.js";
import http from "http";
import { ipcMainEvents } from "./ipcEvents/index.js";

let server: http.Server;
let mainWindow: BrowserWindow;
let taskOverlayWindow: BrowserWindow;

app.on("ready", () => {
  mainWindow = createMainWindow();
  taskOverlayWindow = createTaskOverlayWindow();
  checkDirectories();
  server = startServer(mainWindow);
  createTray(mainWindow);
  createMenu(mainWindow);
  handleCloseEvents(mainWindow, taskOverlayWindow);
  ipcMainEvents(mainWindow);
});

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    minWidth: 800,
    height: 700,
    minHeight: 513,
    frame: false,
    webPreferences: {
      preload: getPreloadPath(),
    },
  });

  if (isDev()) {
    mainWindow.loadURL("http://localhost:5123");
  } else {
    mainWindow.loadFile(getUIPath());
  }

  return mainWindow;
}

function handleCloseEvents(mainWindow: BrowserWindow, taskOverlayWindow: BrowserWindow) {
  /* Handle minimizing to tray */
  let willClose = false;

  mainWindow.on("close", (e) => {
    if (willClose) {
      return;
    }
    e.preventDefault();
    showNotification("Application still running but minimized to tray");
    mainWindow.hide();
    taskOverlayWindow.hide();
    if (app.dock) {
      app.dock.hide();
    }
  });

  // Reset willClose when we open the app from the tray again
  app.on("before-quit", () => {
    willClose = true;
    shutDown(server);
  });

  mainWindow.on("show", () => {
    willClose = false;
    taskOverlayWindow.show();
  });

  // Handle task overlay window events
  taskOverlayWindow.on("close", (e) => {
    if (willClose) {
      return;
    }
    e.preventDefault();
    taskOverlayWindow.hide();
  });
}
