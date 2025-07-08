interface AgentStatus {
  state: "analyzing" | "awaiting" | "feedback" | "idle" | "error";
  message?: string;
  isAudioPlaying?: boolean;
  audioMessage?: string;
  timestamp?: number;
  action?: string;
}

interface Window {
  electron: {
    startServer: (callback: (message: string) => void) => void;
    sendFrameAction: (payload: "close" | "minimize" | "maximize") => void;
    startOverlay: () => void;
    startAgentOverlay: () => void;
    stopAgentOverlay: () => void;
    updateAgentStatus: (status: AgentStatus) => void;
    onAgentStatusUpdate: (callback: (status: AgentStatus) => void) => void;
    openExternalLink: (url: string) => void;
    openHudsDirectory: () => void;
  };
  update: {
    updateMessage: (callback: (message: string) => void) => void;
  };
  players: {
    getPlayers: () => Promise<Player[]>;
  };
  teams: {
    getTeams: () => Promise<Team[]>;
  };
  matches: {
    getMatches: () => Promise<Match[]>;
  };
} 