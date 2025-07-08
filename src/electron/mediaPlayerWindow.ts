/**
 * Media Player Overlay Window
 * 
 * Creates and manages a dedicated Electron window for displaying recently captured
 * clips and screenshots in a small, non-intrusive overlay.
 */

import { BrowserWindow, screen } from "electron";
import { getPreloadPath, getUIPath } from "./helpers/index.js";
import path from "path";

/**
 * Creates a dedicated Media Player Overlay window for displaying:
 * - Recently captured screenshots
 * - Recently recorded video clips
 * - Basic playback controls
 * - Navigation between multiple media items
 */
export function createMediaPlayerWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.workAreaSize;

  const windowWidth = 320;
  const windowHeight = 240;

  const mediaOverlay = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: screenWidth - windowWidth - 50,
    y: 350, // Below the task overlay
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
  console.log('Loading Media Player UI from:', uiPath);

  if (uiPath.startsWith('http')) {
    mediaOverlay.loadURL(`${uiPath}/src/pages/media-player.html`);
  } else {
    mediaOverlay.loadFile(path.join(uiPath, 'media-player.html'));
  }
  
  // Set to ignore mouse events by default
  mediaOverlay.setIgnoreMouseEvents(true);
  
  // Prevent the window from stealing focus
  mediaOverlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  
  // Set window level to stay on top of games
  mediaOverlay.setAlwaysOnTop(true, 'screen-saver');

  // Ensure the window is always visible when shown
  mediaOverlay.setSkipTaskbar(false);
  mediaOverlay.moveTop();

  return mediaOverlay;
}

/**
 * Shows the media player overlay with animation
 */
export function showMediaPlayer(mediaOverlay: BrowserWindow) {
  if (!mediaOverlay.isVisible()) {
    mediaOverlay.show();
    mediaOverlay.webContents.send('animate-in');
  }
}

/**
 * Hides the media player overlay with animation
 */
export function hideMediaPlayer(mediaOverlay: BrowserWindow) {
  if (mediaOverlay.isVisible()) {
    mediaOverlay.webContents.send('animate-out');
    setTimeout(() => mediaOverlay.hide(), 300); // Wait for animation
  }
}

/**
 * Updates the media player with new content
 */
export function updateMediaPlayer(
  mediaOverlay: BrowserWindow,
  data: {
    type: 'image' | 'video';
    path: string;
    timestamp: number;
  }
) {
  if (mediaOverlay.isVisible()) {
    mediaOverlay.webContents.send('update-media', data);
  }
}

/**
 * Enables/disables mouse interaction with the overlay
 */
export function setMediaPlayerInteractive(
  mediaOverlay: BrowserWindow,
  interactive: boolean
) {
  mediaOverlay.setIgnoreMouseEvents(!interactive);
}

export default {
  createMediaPlayerWindow,
  showMediaPlayer,
  hideMediaPlayer,
  updateMediaPlayer,
  setMediaPlayerInteractive
}; 