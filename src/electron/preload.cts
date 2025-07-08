const electron = require("electron");
const { contextBridge, ipcRenderer } = electron;

console.log('Preload script starting...');

type AgentStatusState = "analyzing" | "awaiting" | "feedback" | "idle" | "error";

interface AgentStatus {
  state: AgentStatusState;
  message?: string;
  isAudioPlaying?: boolean;
  audioMessage?: string;
  timestamp?: number;
  action?: string;
}

type FrameWindowAction = "close" | "minimize" | "maximize";

interface Window {
  electron: {
    startServer: (callback: (message: string) => void) => void;
    sendFrameAction: (payload: FrameWindowAction) => void;
    startOverlay: () => void;
    startAgentOverlay: () => void;
    stopAgentOverlay: () => void;
    updateAgentStatus: (status: AgentStatus) => void;
    onAgentStatusUpdate: (callback: (status: AgentStatus) => void) => void;
    openExternalLink: (url: string) => void;
    openHudsDirectory: () => void;
  };
}

// Log all available IPC channels
console.log('Available IPC channels:', ipcRenderer.eventNames());

const api = {
  startServer: (callback: (message: string) => void) =>
    ipcOn("startServer", (response) => {
      callback(response);
    }),

  sendFrameAction: (payload: FrameWindowAction) => {
    console.log('Sending frame action:', payload);
    ipcSend("sendFrameAction", payload);
  },

  // Game HUD overlay
  startOverlay: () => {
    console.log('Starting game HUD overlay');
    ipcSend("startOverlay", undefined);
  },
  
  // Agent AI Overlay
  startAgentOverlay: () => {
    console.log('Starting agent overlay');
    ipcSend("startAgentOverlay", undefined);
  },
  stopAgentOverlay: () => {
    console.log('Stopping agent overlay');
    ipcSend("stopAgentOverlay", undefined);
  },
  updateAgentStatus: (status: AgentStatus) => {
    console.log('Updating agent status:', status);
    ipcSend("updateAgentStatus", status);
  },
  onAgentStatusUpdate: (callback: (status: AgentStatus) => void) => {
    console.log('Setting up agent status update listener');
    ipcOn("agent-status-update", callback);
  },

  openExternalLink: (url: string) => {
    console.log('Opening external link:', url);
    ipcSend("openExternalLink", url);
  },
  openHudsDirectory: () => {
    console.log('Opening HUDs directory');
    ipcSend("openHudsDirectory", undefined);
  },
};

// Log the API being exposed
console.log('Exposing electron API with methods:', Object.keys(api));

contextBridge.exposeInMainWorld("electron", api);

console.log('Preload script finished.');

function ipcInvoke<Key extends keyof EventPayloadMapping>(
  key: Key,
): Promise<EventPayloadMapping[Key]> {
  return ipcRenderer.invoke(key);
}

/* Using callbacks because these functions are async */
function ipcOn<Key extends keyof EventPayloadMapping>(
  key: Key,
  callback: (payload: EventPayloadMapping[Key]) => void,
) {
  ipcRenderer.on(key, (_: Electron.IpcRendererEvent, payload: EventPayloadMapping[Key]) => callback(payload));
}

function ipcSend<Key extends keyof EventPayloadMapping>(
  key: Key,
  payload: EventPayloadMapping[Key],
) {
  ipcRenderer.send(key, payload);
}
