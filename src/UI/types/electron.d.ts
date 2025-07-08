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
    api: {
      // Window control
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      // HUD control
      openHud: () => void;
      closeHud: () => void;
      // Agent overlay control
      openAgentOverlay: () => void;
      closeAgentOverlay: () => void;
      // Task overlay control
      openTaskOverlay: () => void;
      closeTaskOverlay: () => void;
      showTaskOverlay: () => void;
      hideTaskOverlay: () => void;
      updateTask: (data: any) => void;
      updateTaskProgress: (progress: any) => void;
      updateTaskStatus: (status: any) => void;
      // Media player control
      openMediaPlayer: () => void;
      closeMediaPlayer: () => void;
      showMediaPlayer: () => void;
      hideMediaPlayer: () => void;
      updateMedia: (data: { type: 'image' | 'video'; path: string; timestamp: number }) => void;
      setMediaPlayerInteractive: (interactive: boolean) => void;
      // Event listeners
      on: (channel: string, callback: Function) => void;
      off: (channel: string, callback: Function) => void;
    };
  }
}

export {}; 