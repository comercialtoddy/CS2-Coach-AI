export type AgentStatusState = "analyzing" | "awaiting" | "feedback" | "idle" | "error";

export interface AgentStatus {
  state: AgentStatusState;
  message?: string;
  isAudioPlaying?: boolean;
  audioMessage?: string;
  timestamp?: number;
  action?: string;
}

export type FrameWindowAction = "close" | "minimize" | "maximize";

export interface EventPayloadMapping {
  startServer: string;
  sendFrameAction: FrameWindowAction;
  startOverlay: undefined;
  startAgentOverlay: undefined;
  stopAgentOverlay: undefined;
  updateAgentStatus: AgentStatus;
  "agent-status-update": AgentStatus;
  openExternalLink: string;
  openHudsDirectory: undefined;
  "minimize-window": undefined;
  "maximize-window": undefined;
  "close-window": undefined;
  "open-agent-overlay": undefined;
  "close-agent-overlay": undefined;
  "open-task-overlay": undefined;
  "close-task-overlay": undefined;
  "open-media-player": undefined;
  "close-media-player": undefined;
  "open-external-link": string;
} 