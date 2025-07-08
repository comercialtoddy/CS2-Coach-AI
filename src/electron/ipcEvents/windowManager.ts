import {
  agentOverlayWindow,
  taskOverlayWindow,
  mediaPlayerWindow,
} from "./ipMainEvents.js";

export function closeWindows() {
  if (agentOverlayWindow) {
    agentOverlayWindow.close();
  }

  if (taskOverlayWindow) {
    taskOverlayWindow.close();
  }

  if (mediaPlayerWindow) {
    mediaPlayerWindow.close();
  }
} 