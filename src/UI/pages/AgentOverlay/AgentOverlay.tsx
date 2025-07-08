import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAgentSocket } from '../../hooks/useAgentSocket';

interface AgentStatus {
  state: 'idle' | 'analyzing' | 'awaiting' | 'feedback' | 'error';
  message: string;
  timestamp: number;
}

export const AgentOverlay: React.FC = () => {
  const [agentStatus, setAgentStatus] = useState<AgentStatus>({
    state: 'idle',
    message: 'CS2 Coach AI Agent Ready',
    timestamp: Date.now()
  });

  const { isConnected, error } = useAgentSocket({
    onStatusUpdate: (status) => setAgentStatus(status)
  });

  return (
    <div className="fixed top-4 right-4 z-50 pointer-events-none">
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="bg-black/80 backdrop-blur-sm rounded-lg p-4 shadow-lg min-w-[240px]"
        >
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-500' : error ? 'bg-red-500' : 'bg-yellow-500 animate-pulse'
            }`} />
            <span className="text-sm font-medium text-white/90">
              {agentStatus.state.charAt(0).toUpperCase() + agentStatus.state.slice(1)}
            </span>
          </div>
          
          <p className="mt-2 text-sm text-white/70">
            {agentStatus.message}
          </p>

          {agentStatus.state === 'feedback' && (
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              className="mt-2 h-1 bg-blue-500 rounded-full origin-left"
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}; 