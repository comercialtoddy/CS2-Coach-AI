import { contextBridge, ipcRenderer } from "electron";

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("api", {
  // Window control
  minimize: () => ipcRenderer.send("minimize-window"),
  maximize: () => ipcRenderer.send("maximize-window"),
  close: () => ipcRenderer.send("close-window"),

  // HUD control
  openHud: () => ipcRenderer.send("open-hud"),
  closeHud: () => ipcRenderer.send("close-hud"),

  // Agent overlay control
  openAgentOverlay: () => ipcRenderer.send("open-agent-overlay"),
  closeAgentOverlay: () => ipcRenderer.send("close-agent-overlay"),

  // Task overlay control
  openTaskOverlay: () => ipcRenderer.send("open-task-overlay"),
  closeTaskOverlay: () => ipcRenderer.send("close-task-overlay"),
  showTaskOverlay: () => ipcRenderer.send("show-task-overlay"),
  hideTaskOverlay: () => ipcRenderer.send("hide-task-overlay"),
  updateTask: (data: any) => ipcRenderer.send("update-task", data),
  updateTaskProgress: (progress: any) => ipcRenderer.send("update-task-progress", progress),
  updateTaskStatus: (status: any) => ipcRenderer.send("update-task-status", status),

  // Event listeners
  on: (channel: string, callback: Function) => {
    const validChannels = [
      'update-task',
      'update-progress',
      'update-status',
      'animate-in',
      'animate-out'
    ];
    if (validChannels.includes(channel)) {
      // Deliberately strip event as it includes `sender` 
      ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    }
  },
  off: (channel: string, callback: Function) => {
    const validChannels = [
      'update-task',
      'update-progress',
      'update-status',
      'animate-in',
      'animate-out'
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.off(channel, (_event, ...args) => callback(...args));
    }
  }
});

contextBridge.exposeInMainWorld(
  'electron',
  {
    // IPC communication
    sendFrameAction: (action: string) => {
      ipcRenderer.send('sendFrameAction', action);
    },
    openExternalLink: (url: string) => {
      ipcRenderer.send('openExternalLink', url);
    },
    // Screenshot functionality
    captureScreenshot: async (options?: {
      displayId?: string;
      region?: { x: number; y: number; width: number; height: number };
      outputPath?: string;
    }) => {
      return ipcRenderer.invoke('captureScreenshot', options);
    },
    selectScreenshotRegion: async () => {
      return ipcRenderer.invoke('selectScreenshotRegion');
    }
  }
); 