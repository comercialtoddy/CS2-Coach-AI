import { BrowserWindow, screen } from "electron";
import { getPreloadPath, getHudPath } from "./helpers/index.js";
import path from "path";

/**
 * Creates a dedicated Game HUD Overlay window for displaying game information
 * like player stats, team info, and match details.
 * 
 * This overlay shows:
 * - Player stats
 * - Team information
 * - Match details
 * - Real-time game state
 */
export function createHudWindow() {
  // Get the primary display size
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  console.log('Creating HUD window with dimensions:', { width, height });
  console.log('Loading HUD from:', path.join(getHudPath(), 'index.html'));

  const hudWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
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
      devTools: true // Enable DevTools for debugging
    },
  });

  // Load the HUD HTML file
  const hudPath = path.join(getHudPath(), 'index.html');
  hudWindow.loadFile(hudPath);
  
  // Open DevTools for debugging
  hudWindow.webContents.openDevTools({ mode: 'detach' });

  // Log any load errors
  hudWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load HUD:', { errorCode, errorDescription });
  });

  // Log when the window is ready
  hudWindow.webContents.on('did-finish-load', () => {
    console.log('HUD window loaded successfully');
  });
  
  // Set to ignore mouse events so users can interact with the game underneath
  hudWindow.setIgnoreMouseEvents(true);
  
  // Prevent the window from stealing focus
  hudWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  
  // Set window level to stay on top of games
  hudWindow.setAlwaysOnTop(true, 'screen-saver');

  // Ensure the window is always visible
  hudWindow.setSkipTaskbar(false);
  hudWindow.moveTop();

  // Add window management event handlers
  hudWindow.on('closed', () => {
    console.log('HUD window closed');
  });

  hudWindow.on('show', () => {
    console.log('HUD window shown');
  });

  hudWindow.on('hide', () => {
    console.log('HUD window hidden');
  });

  return hudWindow;
}
