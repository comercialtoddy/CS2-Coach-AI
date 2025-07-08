/**
 * Task Overlay Window
 * 
 * Creates and manages a dedicated Electron window for displaying the current task,
 * its progress, and status in a minimalist, non-intrusive overlay.
 */

import { BrowserWindow, screen } from "electron";
import { getPreloadPath, getUIPath } from "./helpers/index.js";

/**
 * Creates a dedicated Task Overlay window for displaying:
 * - Current active task description
 * - Progress bar/counter
 * - Status indicator (Active, Completed, Failed)
 * - Real-time updates via Socket.io
 */
export function createTaskOverlayWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.workAreaSize;

  const windowWidth = 400;
  const windowHeight = 160;

  const taskOverlay = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: screenWidth - windowWidth - 50,
    y: 180, // Below the agent overlay
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
  console.log('Loading Task Overlay UI from:', uiPath);

  if (uiPath.startsWith('http')) {
    taskOverlay.loadURL(`${uiPath}/src/pages/task-overlay.html`);
  } else {
    taskOverlay.loadFile(uiPath); // This will need to be adjusted for production build
  }
  
  // Set to ignore mouse events so users can interact with the game underneath
  taskOverlay.setIgnoreMouseEvents(true);
  
  // Prevent the window from stealing focus
  taskOverlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  
  // Set window level to stay on top of games
  taskOverlay.setAlwaysOnTop(true, 'screen-saver');

  // Ensure the window is always visible
  taskOverlay.setSkipTaskbar(false);
  taskOverlay.moveTop();

  return taskOverlay;
}

/**
 * Shows the task overlay window with animation
 */
export function showTaskOverlay(taskOverlay: BrowserWindow) {
  if (!taskOverlay.isVisible()) {
    taskOverlay.show();
    taskOverlay.webContents.send('animate-in');
  }
}

/**
 * Hides the task overlay window with animation
 */
export function hideTaskOverlay(taskOverlay: BrowserWindow) {
  if (taskOverlay.isVisible()) {
    taskOverlay.webContents.send('animate-out');
    setTimeout(() => taskOverlay.hide(), 300); // Wait for animation
  }
}

/**
 * Updates the task overlay with new task information
 */
export function updateTaskOverlay(
  taskOverlay: BrowserWindow,
  data: {
    taskId: string;
    title: string;
    description: string;
    progress: {
      current: number;
      target: number;
      percentage: number;
    };
    status: 'active' | 'completed' | 'failed';
  }
) {
  if (taskOverlay.isVisible()) {
    taskOverlay.webContents.send('update-task', data);
  }
}

/**
 * Updates just the progress information in the task overlay
 */
export function updateTaskProgress(
  taskOverlay: BrowserWindow,
  progress: {
    current: number;
    target: number;
    percentage: number;
  }
) {
  if (taskOverlay.isVisible()) {
    taskOverlay.webContents.send('update-progress', progress);
  }
}

/**
 * Updates the task status in the overlay
 */
export function updateTaskStatus(
  taskOverlay: BrowserWindow,
  status: 'active' | 'completed' | 'failed'
) {
  if (taskOverlay.isVisible()) {
    taskOverlay.webContents.send('update-status', { status });
  }
}

export default {
  createTaskOverlayWindow,
  showTaskOverlay,
  hideTaskOverlay,
  updateTaskOverlay,
  updateTaskProgress,
  updateTaskStatus
}; 