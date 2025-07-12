import React from 'react';
import { motion } from 'framer-motion';

interface HUDCardProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
  glowColor?: 'blue' | 'green' | 'orange' | 'red' | 'purple';
  animated?: boolean;
}

const glowColors = {
  blue: 'shadow-blue-500/20 border-blue-500/30',
  green: 'shadow-green-500/20 border-green-500/30',
  orange: 'shadow-orange-500/20 border-orange-500/30',
  red: 'shadow-red-500/20 border-red-500/30',
  purple: 'shadow-purple-500/20 border-purple-500/30'
};

export const HUDCard: React.FC<HUDCardProps> = ({ 
  children, 
  title, 
  className = '', 
  glowColor = 'blue',
  animated = true 
}) => {
  const cardContent = (
    <div className={`
      relative overflow-hidden rounded-lg border bg-gradient-to-br from-background-secondary/80 to-background-primary/60
      backdrop-blur-sm ${glowColors[glowColor]} transition-all duration-300 hover:shadow-lg
      ${className}
    `}>
      {/* HUD Corner Elements */}
      <div className="absolute top-0 left-0 w-4 h-4 border-l-2 border-t-2 border-primary opacity-60" />
      <div className="absolute top-0 right-0 w-4 h-4 border-r-2 border-t-2 border-primary opacity-60" />
      <div className="absolute bottom-0 left-0 w-4 h-4 border-l-2 border-b-2 border-primary opacity-60" />
      <div className="absolute bottom-0 right-0 w-4 h-4 border-r-2 border-b-2 border-primary opacity-60" />
      
      {/* Subtle scan line effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent opacity-30" />
      
      {title && (
        <div className="border-b border-border/50 p-4">
          <h3 className="text-lg font-semibold text-text flex items-center gap-2">
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            {title}
          </h3>
        </div>
      )}
      
      <div className="p-4">
        {children}
      </div>
    </div>
  );

  if (animated) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        whileHover={{ scale: 1.02 }}
      >
        {cardContent}
      </motion.div>
    );
  }

  return cardContent;
};