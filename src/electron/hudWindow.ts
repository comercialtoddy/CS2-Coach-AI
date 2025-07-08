import { BrowserWindow } from "electron";
import { getHudPath, getPreloadPath, getUIPath } from "./helpers/index.js";
import { checkDirectories } from "./helpers/util.js";
import path from "path";

export function createHudWindow() {
  const hudWindow = new BrowserWindow({
    fullscreen: true,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    focusable: true,
    frame: false,
    webPreferences: {
      preload: getPreloadPath(),
      backgroundThrottling: false,
    },
  });

  checkDirectories();
  hudWindow.loadFile(path.join(getHudPath(), "index.html"));
  hudWindow.setIgnoreMouseEvents(true);

  return hudWindow;
}

/**
 * Creates a dedicated Agent AI Overlay window for displaying AI agent status,
 * audio indicators, and real-time feedback information.
 * 
 * This overlay is separate from the game HUD and shows:
 * - Agent status: "Analyzing", "Awaiting", "Feedback"
 * - Audio indicator when TTS is playing
 * - Real-time updates via Socket.io
 */
export function createAgentOverlayWindow() {
  const agentOverlay = new BrowserWindow({
    width: 320,
    height: 120,
    x: 50,
    y: 50,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    type: 'toolbar',
    resizable: false,
    minimizable: false,
    maximizable: false,
    focusable: false,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: getPreloadPath(),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
      webSecurity: true,
    },
  });

  const uiPath = getUIPath();
  console.log('Loading UI from:', uiPath);

  if (uiPath.startsWith('http')) {
    agentOverlay.loadURL(uiPath);
  } else {
    agentOverlay.loadFile(uiPath);
  }
  
  // Set to ignore mouse events so users can interact with the game underneath
  agentOverlay.setIgnoreMouseEvents(true);
  
  // Prevent the window from stealing focus
  agentOverlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  
  // Set window level to stay on top of games
  agentOverlay.setAlwaysOnTop(true, 'screen-saver');

  // Ensure the window is always visible
  agentOverlay.setSkipTaskbar(false);
  agentOverlay.moveTop();

  return agentOverlay;
}
