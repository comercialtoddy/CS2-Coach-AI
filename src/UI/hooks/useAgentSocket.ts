import { useEffect, useState, useCallback } from 'react';
import io, { Socket } from 'socket.io-client';

interface AgentStatus {
  state: 'idle' | 'analyzing' | 'awaiting' | 'feedback' | 'error';
  message: string;
  timestamp: number;
}

interface UseAgentSocketProps {
  onStatusUpdate?: (status: AgentStatus) => void;
}

export const useAgentSocket = ({ onStatusUpdate }: UseAgentSocketProps) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const newSocket = io('http://localhost:1349', {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('Socket.io connected');
      setIsConnected(true);
      setError(null);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket.io disconnected');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket.io connection error:', err);
      setError(err.message);
      setIsConnected(false);
    });

    newSocket.on('agent-status-update', (status: AgentStatus) => {
      console.log('Received agent status update:', status);
      onStatusUpdate?.(status);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [onStatusUpdate]);

  const sendAgentCommand = useCallback((command: string, data?: any) => {
    if (socket?.connected) {
      socket.emit('agent-command', { command, data });
    }
  }, [socket]);

  const requestCurrentStatus = useCallback(() => {
    if (socket?.connected) {
      socket.emit('agent-request-status');
    }
  }, [socket]);

  return {
    isConnected,
    error,
    sendAgentCommand,
    requestCurrentStatus
  };
}; 