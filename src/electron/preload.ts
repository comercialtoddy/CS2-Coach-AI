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

  // Media player control
  openMediaPlayer: () => ipcRenderer.send("open-media-player"),
  closeMediaPlayer: () => ipcRenderer.send("close-media-player"),
  showMediaPlayer: () => ipcRenderer.send("show-media-player"),
  hideMediaPlayer: () => ipcRenderer.send("hide-media-player"),
  updateMedia: (data: { type: 'image' | 'video'; path: string; timestamp: number }) => 
    ipcRenderer.send("update-media", data),
  setMediaPlayerInteractive: (interactive: boolean) => 
    ipcRenderer.send("set-media-player-interactive", interactive),

  // Event listeners
  on: (channel: string, callback: Function) => {
    const validChannels = [
      'update-task',
      'update-progress',
      'update-status',
      'animate-in',
      'animate-out',
      'update-media'
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
      'animate-out',
      'update-media'
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
    ipcSend: (channel: string, data: any) => {
      ipcRenderer.send(channel, data);
    },
    ipcReceive: (channel: string, func: Function) => {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    },
    ipcRemove: (channel: string) => {
      ipcRenderer.removeAllListeners(channel);
    },
    ipcInvoke: (channel: string, data: any) => {
      return ipcRenderer.invoke(channel, data);
    },
    // Window Controls
    minimizeWindow: () => ipcRenderer.send("minimize-window"),
    maximizeWindow: () => ipcRenderer.send("maximize-window"),
    closeWindow: () => ipcRenderer.send("close-window"),

    // Agent Overlay
    openAgentOverlay: () => ipcRenderer.send("open-agent-overlay"),
    closeAgentOverlay: () => ipcRenderer.send("close-agent-overlay"),

    // Task Overlay
    openTaskOverlay: () => ipcRenderer.send("open-task-overlay"),
    closeTaskOverlay: () => ipcRenderer.send("close-task-overlay"),

    // Media Player
    openMediaPlayer: () => ipcRenderer.send("open-media-player"),
    closeMediaPlayer: () => ipcRenderer.send("close-media-player"),

    // External Links
    openExternalLink: (url: string) => ipcRenderer.send("open-external-link", url),
  }
); 