import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface AgentStatus {
  state: "analyzing" | "awaiting" | "feedback" | "idle" | "error";
  message?: string;
  isAudioPlaying?: boolean;
  audioMessage?: string;
  timestamp?: number;
  action?: string;
}

interface UseAgentSocketProps {
  onStatusUpdate?: (status: AgentStatus) => void;
  onAudioUpdate?: (isPlaying: boolean, message?: string) => void;
  onError?: (error: string) => void;
}

export const useAgentSocket = ({ 
  onStatusUpdate, 
  onAudioUpdate, 
  onError 
}: UseAgentSocketProps = {}) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Connect to Socket.io server
  useEffect(() => {
    // Connect to the local server (same port as Express server)
    const newSocket = io('http://localhost:1349', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      timeout: 5000,
    });

    setSocket(newSocket);

    // Connection event handlers
    newSocket.on('connect', () => {
      console.log('Agent Socket connected:', newSocket.id);
      setIsConnected(true);
      setError(null);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Agent Socket disconnected:', reason);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.error('Agent Socket connection error:', err);
      setError(`Connection error: ${err.message}`);
      setIsConnected(false);
      onError?.(err.message);
    });

    // Agent-specific event listeners
    newSocket.on('agent-status-update', (status: AgentStatus) => {
      console.log('Received agent status update:', status);
      onStatusUpdate?.(status);
    });

    newSocket.on('agent-audio-update', (data: { isPlaying: boolean; message?: string }) => {
      console.log('Received agent audio update:', data);
      onAudioUpdate?.(data.isPlaying, data.message);
    });

    newSocket.on('agent-error', (errorMessage: string) => {
      console.error('Agent error received:', errorMessage);
      setError(errorMessage);
      onError?.(errorMessage);
    });

    // Cleanup on unmount
    return () => {
      console.log('Cleaning up agent socket connection');
      newSocket.close();
    };
  }, [onStatusUpdate, onAudioUpdate, onError]);

  // Send agent command
  const sendAgentCommand = useCallback((command: string, data?: any) => {
    if (socket && isConnected) {
      console.log('Sending agent command:', command, data);
      socket.emit('agent-command', { command, data, timestamp: Date.now() });
    } else {
      console.warn('Cannot send agent command: socket not connected');
    }
  }, [socket, isConnected]);

  // Update agent status (can be called from UI)
  const updateAgentStatus = useCallback((status: Partial<AgentStatus>) => {
    if (socket && isConnected) {
      const fullStatus: AgentStatus = {
        state: status.state || 'idle',
        message: status.message,
        isAudioPlaying: status.isAudioPlaying,
        audioMessage: status.audioMessage,
        timestamp: status.timestamp || Date.now(),
        action: status.action
      };
      
      console.log('Sending agent status update:', fullStatus);
      socket.emit('agent-status-update', fullStatus);
    }
  }, [socket, isConnected]);

  // Request current status from server
  const requestCurrentStatus = useCallback(() => {
    if (socket && isConnected) {
      console.log('Requesting current agent status');
      socket.emit('agent-request-status');
    }
  }, [socket, isConnected]);

  // Notify about TTS audio events
  const notifyAudioEvent = useCallback((event: 'start' | 'end', message?: string) => {
    if (socket && isConnected) {
      console.log('Notifying audio event:', event, message);
      socket.emit('agent-audio-event', { event, message, timestamp: Date.now() });
    }
  }, [socket, isConnected]);

  return {
    socket,
    isConnected,
    error,
    sendAgentCommand,
    updateAgentStatus,
    requestCurrentStatus,
    notifyAudioEvent,
  };
}; 