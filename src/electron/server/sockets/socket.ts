import { Server } from "socket.io";
import http from "http";

export let io: Server;

interface AgentStatus {
  state: "analyzing" | "awaiting" | "feedback" | "idle" | "error";
  message?: string;
  isAudioPlaying?: boolean;
  audioMessage?: string;
  timestamp?: number;
  action?: string;
}

// Global agent status store
let currentAgentStatus: AgentStatus = {
  state: 'idle',
  message: 'OpenHud Agent Ready',
  timestamp: Date.now()
};

export function initializeSocket(server: http.Server) {
  io = new Server(server, {
    cors: {
      origin: "*",
    },
  });

  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);
    
    // Send initial data
    socket.emit("update", { data: "Initial data from server" });
    
    // Send current agent status to new connections
    socket.emit("agent-status-update", currentAgentStatus);

    // Agent-specific event handlers
    socket.on("agent-command", (data) => {
      console.log("Received agent command:", data);
      // Handle agent commands (can integrate with AI tooling system)
      handleAgentCommand(data.command, data.data, socket);
    });

    socket.on("agent-status-update", (status: AgentStatus) => {
      console.log("Received agent status update:", status);
      // Update global status
      currentAgentStatus = {
        ...currentAgentStatus,
        ...status,
        timestamp: Date.now()
      };
      // Broadcast to all connected clients
      socket.broadcast.emit("agent-status-update", currentAgentStatus);
    });

    socket.on("agent-request-status", () => {
      console.log("Agent status requested by client:", socket.id);
      socket.emit("agent-status-update", currentAgentStatus);
    });

    socket.on("agent-audio-event", (data) => {
      console.log("Received agent audio event:", data);
      // Update audio status in current state
      currentAgentStatus = {
        ...currentAgentStatus,
        isAudioPlaying: data.event === 'start',
        audioMessage: data.event === 'start' ? data.message : undefined,
        timestamp: Date.now()
      };
      // Broadcast audio update to all clients
      io.emit("agent-audio-update", {
        isPlaying: currentAgentStatus.isAudioPlaying,
        message: currentAgentStatus.audioMessage
      });
    });

    // Legacy event handlers
    socket.on("match", () => {
      console.log("Legacy match event received");
    });

    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

// Agent command handler function
function handleAgentCommand(command: string, data: any, socket: any) {
  switch (command) {
    case 'start-analysis':
      updateAgentStatus('analyzing', 'Starting analysis...', 'Analyzing game state');
      break;
    
    case 'request-feedback':
      updateAgentStatus('awaiting', 'Waiting for user input...', 'Awaiting user decision');
      break;
    
    case 'provide-feedback':
      updateAgentStatus('feedback', 'Providing feedback...', 'Generating response');
      break;
    
    case 'reset':
      updateAgentStatus('idle', 'Agent ready', undefined);
      break;
    
    case 'simulate-tts':
      // Simulate TTS audio playback
      simulateAudioEvent(data?.message || 'Test audio message');
      break;
    
    default:
      console.log('Unknown agent command:', command);
      socket.emit('agent-error', `Unknown command: ${command}`);
  }
}

// Helper function to update agent status
export function updateAgentStatus(
  state: AgentStatus['state'], 
  message?: string, 
  action?: string
) {
  currentAgentStatus = {
    ...currentAgentStatus,
    state,
    message,
    action,
    timestamp: Date.now()
  };
  
  console.log('Broadcasting agent status update:', currentAgentStatus);
  
  // Broadcast to all connected clients
  if (io) {
    io.emit("agent-status-update", currentAgentStatus);
  }
}

// Helper function to simulate audio events
export function simulateAudioEvent(message: string) {
  // Start audio
  currentAgentStatus = {
    ...currentAgentStatus,
    isAudioPlaying: true,
    audioMessage: message,
    timestamp: Date.now()
  };
  
  if (io) {
    io.emit("agent-audio-update", {
      isPlaying: true,
      message: message
    });
  }
  
  // Simulate audio ending after 3 seconds
  setTimeout(() => {
    currentAgentStatus = {
      ...currentAgentStatus,
      isAudioPlaying: false,
      audioMessage: undefined,
      timestamp: Date.now()
    };
    
    if (io) {
      io.emit("agent-audio-update", {
        isPlaying: false,
        message: undefined
      });
    }
  }, 3000);
}

// Get current agent status (for external use)
export function getCurrentAgentStatus(): AgentStatus {
  return { ...currentAgentStatus };
}
