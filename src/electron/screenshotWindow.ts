import { BrowserWindow, screen } from 'electron';
import { getPreloadPath, getUIPath } from './helpers/index.js';
import path from 'path';

/**
 * Creates a transparent overlay window for screenshot area selection
 */
export function createScreenshotSelectorWindow(): Promise<BrowserWindow> {
  return new Promise((resolve) => {
    // Get the primary display
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    // Create a transparent window that covers the entire screen
    const selectorWindow = new BrowserWindow({
      width,
      height,
      x: 0,
      y: 0,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      fullscreen: true,
      webPreferences: {
        preload: getPreloadPath(),
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true
      }
    });

    // Load the screenshot selector component
    const uiPath = getUIPath();
    if (uiPath.startsWith('http')) {
      selectorWindow.loadURL(`${uiPath}#/screenshot-selector`);
    } else {
      selectorWindow.loadFile(path.join(uiPath, 'screenshot-selector.html'));
    }

    // Hide the window initially
    selectorWindow.hide();

    // When the window is ready to show
    selectorWindow.once('ready-to-show', () => {
      resolve(selectorWindow);
    });
  });
}

/**
 * Shows the screenshot selector window and returns the selected region
 */
export async function showScreenshotSelector(): Promise<{ x: number; y: number; width: number; height: number }> {
  const selectorWindow = await createScreenshotSelectorWindow();

  return new Promise((resolve, reject) => {
    // Listen for the region selection
    selectorWindow.webContents.once('ipc-message', (event, channel, region) => {
      if (channel === 'screenshot-region-selected') {
        selectorWindow.close();
        resolve(region);
      }
    });

    // Listen for cancellation
    selectorWindow.webContents.once('ipc-message', (event, channel) => {
      if (channel === 'screenshot-selection-cancelled') {
        selectorWindow.close();
        reject(new Error('Screenshot selection cancelled'));
      }
    });

    // Show the window
    selectorWindow.show();

    // Handle window close
    selectorWindow.once('closed', () => {
      reject(new Error('Screenshot selection cancelled'));
    });
  });
} 