export interface AgentStatus {
  state: AgentStatusState;
  message?: string;
  isAudioPlaying?: boolean;
  audioMessage?: string;
  timestamp?: number;
  action?: string;
}

export type AgentStatusState = "analyzing" | "awaiting" | "feedback" | "idle" | "error";

export interface ElectronAPI {
  startServer: (callback: (message: string) => void) => void;
  sendFrameAction: (payload: "close" | "minimize" | "maximize") => void;
  startOverlay: () => void;
  startAgentOverlay: () => void;
  stopAgentOverlay: () => void;
  updateAgentStatus: (status: AgentStatus) => void;
  onAgentStatusUpdate: (callback: (status: AgentStatus) => void) => void;
  openExternalLink: (url: string) => void;
  openHudsDirectory: () => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}

export {}; 