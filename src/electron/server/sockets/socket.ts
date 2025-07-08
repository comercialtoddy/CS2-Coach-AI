import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';

export interface AgentStatus {
  state: 'idle' | 'analyzing' | 'awaiting' | 'feedback' | 'error';
  message: string;
  timestamp: number;
  action?: string;
}

let currentAgentStatus: AgentStatus = {
  state: 'idle',
  message: 'CS2 Coach AI Agent Ready',
  timestamp: Date.now()
};

// Export io instance that will be set during initialization
export let io: Server;

export const getCurrentAgentStatus = () => currentAgentStatus;

export const updateAgentStatus = (
  state: AgentStatus['state'], 
  message: string, 
  action?: string
) => {
  currentAgentStatus = {
    state,
    message,
    action,
    timestamp: Date.now()
  };
  if (io) {
    io.emit('agent-status-update', currentAgentStatus);
  }
};

export const simulateAudioEvent = (message: string) => {
  if (io) {
    io.emit('agent-audio-update', { message });
  }
};

export const initializeSocket = (httpServer: HttpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Send current status to newly connected client
    socket.emit('agent-status-update', currentAgentStatus);

    // Handle agent commands
    socket.on('agent-command', ({ command, data }) => {
      console.log('Received agent command:', command, data);
      // Process command and update status accordingly
      // This will be expanded based on the AI agent's capabilities
    });

    // Handle status requests
    socket.on('agent-request-status', () => {
      socket.emit('agent-status-update', currentAgentStatus);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  return io;
};
