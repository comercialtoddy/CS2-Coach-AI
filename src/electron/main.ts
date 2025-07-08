import { app, BrowserWindow } from "electron";
import { setupIpcEvents, closeWindows } from "./ipcEvents/index.js";
import { getPreloadPath } from "./helpers/index.js";
import { join } from "path";
import { startServer } from "./server/server.js";
import { createTray } from "./tray.js";
import { createMenu } from "./menu.js";

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  // Create the browser window
  const window = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    webPreferences: {
      preload: getPreloadPath(),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Load the app
  if (process.env.NODE_ENV === "development") {
    window.loadURL("http://localhost:5123");
    window.webContents.openDevTools();
  } else {
    window.loadFile(join(__dirname, "../index.html"));
  }

  // Initialize server and tray
  startServer(window);
  createTray(window);
  createMenu(window);

  // Setup IPC events
  setupIpcEvents();

  // Handle window close
  window.on("closed", () => {
    mainWindow = null;
    closeWindows();
  });

  mainWindow = window;
  return window;
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (mainWindow === null) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
