import { AgentStatus } from '../pages/AgentOverlay/types';

declare global {
  interface Window {
    electron: {
      startServer: (callback: (message: string) => void) => void;
      sendFrameAction: (payload: "close" | "minimize" | "maximize") => void;
      // Game HUD overlay
      startOverlay: () => void;
      // Agent AI Overlay
      startAgentOverlay: () => void;
      stopAgentOverlay: () => void;
      updateAgentStatus: (status: AgentStatus) => void;
      onAgentStatusUpdate: (callback: (status: AgentStatus) => void) => void;
      openExternalLink: (url: string) => void;
      openHudsDirectory: () => void;
    };
  }
}

export {}; 