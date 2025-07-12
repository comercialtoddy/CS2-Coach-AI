import React from 'react';
import { motion } from 'framer-motion';

interface HUDButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  icon?: React.ReactNode;
}

const variants = {
  primary: 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white border-blue-500/50 shadow-blue-500/25',
  secondary: 'bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-500 hover:to-gray-600 text-white border-gray-500/50 shadow-gray-500/25',
  danger: 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white border-red-500/50 shadow-red-500/25',
  success: 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white border-green-500/50 shadow-green-500/25'
};

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg'
};

export const HUDButton: React.FC<HUDButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  className = '',
  icon
}) => {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        relative overflow-hidden rounded-lg border font-semibold transition-all duration-200
        ${variants[variant]} ${sizes[size]}
        ${disabled || loading ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg active:scale-95'}
        ${className}
      `}
      whileHover={!disabled && !loading ? { scale: 1.02 } : {}}
      whileTap={!disabled && !loading ? { scale: 0.98 } : {}}
    >
      {/* HUD Corner accents */}
      <div className="absolute top-0 left-0 w-2 h-2 border-l border-t border-white/30" />
      <div className="absolute top-0 right-0 w-2 h-2 border-r border-t border-white/30" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-l border-b border-white/30" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-r border-b border-white/30" />
      
      {/* Subtle glow effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300" />
      
      <div className="relative flex items-center justify-center gap-2">
        {loading ? (
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          icon && <span className="text-lg">{icon}</span>
        )}
        {children}
      </div>
    </motion.button>
  );
};