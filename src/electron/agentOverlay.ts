import { BrowserWindow, screen } from "electron";
import { getPreloadPath, getUIPath } from "./helpers/index.js";
import path from "path";

/**
 * Creates a dedicated Agent AI Overlay window for displaying AI agent status,
 * audio indicators, and real-time feedback information.
 * 
 * This overlay shows:
 * - Agent status: "Analyzing", "Awaiting", "Feedback"
 * - Audio indicator when TTS is playing
 * - Real-time updates via Socket.io
 */
export function createAgentOverlayWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.workAreaSize;

  const windowWidth = 320;
  const windowHeight = 120;

  const agentOverlay = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: screenWidth - windowWidth - 50,
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
    agentOverlay.loadURL(`${uiPath}/src/pages/agent-overlay.html`);
  } else {
    agentOverlay.loadFile(path.join(uiPath, "agent-overlay.html"));
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
