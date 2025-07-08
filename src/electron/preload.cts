const { contextBridge, ipcRenderer } = require('electron');

console.log('Preload script starting...');

// Log all available IPC channels
console.log('Available IPC channels:', ipcRenderer.eventNames());

type Callback<T = any> = (data: T) => void;
type IpcRendererEvent = { sender: unknown; senderId: number };

const api = {
  startServer: (callback: Callback<string>) => {
    console.log('Setting up startServer listener');
    ipcRenderer.on("startServer", (_: IpcRendererEvent, response: string) => {
      callback(response);
    });
  },

  sendFrameAction: (payload: unknown) => {
    console.log('Sending frame action:', payload);
    ipcRenderer.send("sendFrameAction", payload);
  },

  // Game HUD overlay
  startOverlay: () => {
    console.log('Starting game HUD overlay');
    ipcRenderer.send("start-overlay");
  },
  stopOverlay: () => {
    console.log('Stopping agent overlay');
    ipcRenderer.send("stop-overlay");
  },
  
  // Agent AI Overlay
  updateAgentStatus: (status: unknown) => {
    console.log('Updating agent status:', status);
    ipcRenderer.send("updateAgentStatus", status);
  },
  onAgentStatusUpdate: (callback: Callback) => {
    console.log('Setting up agent status update listener');
    ipcRenderer.on("agent-status-update", (_: IpcRendererEvent, status: unknown) => callback(status));
  },

  openExternalLink: (url: string) => {
    console.log('Opening external link:', url);
    ipcRenderer.send("openExternalLink", url);
  },
  openHudsDirectory: () => {
    console.log('Opening HUDs directory');
    ipcRenderer.send("openHudsDirectory");
  },

  // IPC Send
  ipcSend: (channel: string, data: unknown) => {
    ipcRenderer.send(channel, data);
  },

  // IPC Receive
  ipcReceive: (channel: string, func: Callback) => {
    ipcRenderer.on(channel, (_: IpcRendererEvent, data: unknown) => func(data));
  },

  // IPC Remove
  ipcRemove: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },

  // IPC Invoke
  ipcInvoke: (channel: string, data: unknown) => {
    return ipcRenderer.invoke(channel, data);
  },

  // Window Controls
  minimizeWindow: () => ipcRenderer.send("minimize-window"),
  maximizeWindow: () => ipcRenderer.send("maximize-window"),
  closeWindow: () => ipcRenderer.send("close-window"),

  // Task Overlay
  openTaskOverlay: () => ipcRenderer.send("open-task-overlay"),
  closeTaskOverlay: () => ipcRenderer.send("close-task-overlay"),

  // Media Player
  openMediaPlayer: () => ipcRenderer.send("open-media-player"),
  closeMediaPlayer: () => ipcRenderer.send("close-media-player")
};

// Log the API being exposed
console.log('Exposing electron API with methods:', Object.keys(api));

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electron', api);

console.log('Preload script finished.');
