import React, { useEffect, useState } from 'react';
import { useAgentSocket } from '../../hooks/useAgentSocket';

interface AgentStatus {
  state: "analyzing" | "awaiting" | "feedback" | "idle" | "error";
  message?: string;
  isAudioPlaying?: boolean;
  audioMessage?: string;
  timestamp?: number;
  action?: string;
}

export const AgentOverlay: React.FC = () => {
  const [agentStatus, setAgentStatus] = useState<AgentStatus>({
    state: 'idle',
    message: 'OpenHud Agent Ready',
    timestamp: Date.now()
  });

  // Socket.io integration for real-time updates
  const { 
    isConnected, 
    error: socketError, 
    requestCurrentStatus,
    notifyAudioEvent 
  } = useAgentSocket({
    onStatusUpdate: (status: AgentStatus) => {
      console.log('Agent overlay received status update:', status);
      setAgentStatus(prev => ({
        ...prev,
        ...status,
        timestamp: status.timestamp || Date.now()
      }));
    },
    onAudioUpdate: (isPlaying: boolean, message?: string) => {
      console.log('Agent overlay received audio update:', isPlaying, message);
      setAgentStatus(prev => ({
        ...prev,
        isAudioPlaying: isPlaying,
        audioMessage: message,
        timestamp: Date.now()
      }));
    },
    onError: (error: string) => {
      console.error('Agent socket error:', error);
      setAgentStatus(prev => ({
        ...prev,
        state: 'error',
        message: `Connection error: ${error}`,
        timestamp: Date.now()
      }));
    }
  });

  useEffect(() => {
    // Listen for agent status updates from the main process (IPC fallback)
    if (window.electron?.onAgentStatusUpdate) {
      window.electron.onAgentStatusUpdate((status: AgentStatus) => {
        console.log('Agent overlay received IPC status update:', status);
        setAgentStatus(prev => ({
          ...prev,
          ...status,
          timestamp: status.timestamp || Date.now()
        }));
      });
    }

    // Request current status when component mounts
    const timeoutId = setTimeout(() => {
      requestCurrentStatus();
    }, 1000); // Give socket time to connect

    return () => {
      clearTimeout(timeoutId);
    };
  }, [requestCurrentStatus]);

  // Update connection status in the UI
  useEffect(() => {
    if (!isConnected && !socketError) {
      setAgentStatus(prev => ({
        ...prev,
        state: 'awaiting',
        message: 'Connecting to server...',
        timestamp: Date.now()
      }));
    } else if (isConnected && agentStatus.state === 'awaiting' && agentStatus.message?.includes('Connecting')) {
      setAgentStatus(prev => ({
        ...prev,
        state: 'idle',
        message: 'OpenHud Agent Ready',
        timestamp: Date.now()
      }));
    }
  }, [isConnected, socketError, agentStatus.state, agentStatus.message]);

  const getStatusColor = (state: AgentStatus['state']) => {
    switch (state) {
      case 'analyzing':
        return 'text-yellow-400 border-yellow-400/50';
      case 'awaiting':
        return 'text-blue-400 border-blue-400/50';
      case 'feedback':
        return 'text-green-400 border-green-400/50';
      case 'error':
        return 'text-red-400 border-red-400/50';
      default:
        return 'text-gray-400 border-gray-400/50';
    }
  };

  const getStatusIcon = (state: AgentStatus['state']) => {
    switch (state) {
      case 'analyzing':
        return '🔍';
      case 'awaiting':
        return '⏳';
      case 'feedback':
        return '💬';
      case 'error':
        return '❌';
      default:
        return '🤖';
    }
  };

  const getStatusText = (state: AgentStatus['state']) => {
    switch (state) {
      case 'analyzing':
        return 'Analyzing...';
      case 'awaiting':
        return 'Awaiting';
      case 'feedback':
        return 'Feedback';
      case 'error':
        return 'Error';
      default:
        return 'Ready';
    }
  };

  return (
    <div className="fixed top-0 left-0 w-screen h-screen pointer-events-none">
      <div className="absolute top-4 left-4 pointer-events-none">
        <div
          className={`
            relative bg-black/80 backdrop-blur-sm rounded-lg border
            ${getStatusColor(agentStatus.state)}
            px-4 py-3 min-w-[280px] max-w-[320px]
            animate-in fade-in duration-300 slide-in-from-left-2
          `}
        >
          {/* Main Status Display */}
          <div className="flex items-center gap-3">
            <div
              className={`text-xl transition-transform duration-1000 ${
                agentStatus.state === 'analyzing' ? 'animate-spin' : ''
              }`}
            >
              {getStatusIcon(agentStatus.state)}
            </div>
            
            <div className="flex-1">
              <div className={`font-semibold text-sm ${getStatusColor(agentStatus.state).split(' ')[0]} transition-colors duration-300`}>
                {getStatusText(agentStatus.state)}
              </div>
              {agentStatus.message && (
                <div className="text-xs text-gray-300 mt-1 line-clamp-2 transition-opacity duration-300">
                  {agentStatus.message}
                </div>
              )}
            </div>

            {/* Pulse indicator for active states */}
            {(agentStatus.state === 'analyzing' || agentStatus.state === 'feedback') && (
              <div
                className={`w-2 h-2 rounded-full ${getStatusColor(agentStatus.state).split(' ')[0].replace('text-', 'bg-')} animate-pulse`}
              />
            )}
          </div>

          {/* Audio Indicator */}
          {agentStatus.isAudioPlaying && (
            <div className="mt-3 pt-3 border-t border-gray-600/50 animate-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="w-1 h-3 bg-green-400 rounded-full animate-pulse"
                      style={{
                        animationDelay: `${i * 100}ms`,
                        animationDuration: '600ms'
                      }}
                    />
                  ))}
                </div>
                <span className="text-xs text-green-400 font-medium animate-pulse">
                  🔊 Audio Playing
                </span>
              </div>
              {agentStatus.audioMessage && (
                <div className="text-xs text-gray-300 mt-1">
                  "{agentStatus.audioMessage}"
                </div>
              )}
            </div>
          )}

          {/* Action indicator */}
          {agentStatus.action && (
            <div className="mt-2 text-xs text-gray-400 transition-opacity duration-300">
              Action: {agentStatus.action}
            </div>
          )}

          {/* Connection Status Indicator */}
          <div className="absolute top-1 right-2 flex items-center gap-2">
            <div 
              className={`w-2 h-2 rounded-full ${
                isConnected 
                  ? 'bg-green-400 animate-pulse' 
                  : socketError 
                    ? 'bg-red-400' 
                    : 'bg-yellow-400 animate-pulse'
              }`}
              title={
                isConnected 
                  ? 'Socket.io Connected' 
                  : socketError 
                    ? `Connection Error: ${socketError}` 
                    : 'Connecting...'
              }
            />
            {agentStatus.timestamp && (
              <div className="text-xs text-gray-500 font-mono">
                {new Date(agentStatus.timestamp).toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}; 