/**
 * Task Overlay Styles
 * 
 * Defines the theme and styles for the task overlay component.
 */

import { createTheme } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';

// Custom theme for the task overlay
export const taskOverlayTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#4CAF50', // Green for progress
      light: '#81C784',
      dark: '#388E3C',
    },
    secondary: {
      main: '#2196F3', // Blue for info
      light: '#64B5F6',
      dark: '#1976D2',
    },
    success: {
      main: '#4CAF50', // Green for completed
      light: '#81C784',
      dark: '#388E3C',
    },
    error: {
      main: '#F44336', // Red for failed
      light: '#E57373',
      dark: '#D32F2F',
    },
    info: {
      main: '#2196F3', // Blue for active
      light: '#64B5F6',
      dark: '#1976D2',
    },
    background: {
      default: '#121212',
      paper: '#1E1E1E',
    },
    text: {
      primary: '#FFFFFF',
      secondary: 'rgba(255, 255, 255, 0.7)',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    fontSize: 14,
    fontWeightLight: 300,
    fontWeightRegular: 400,
    fontWeightMedium: 500,
    fontWeightBold: 600,
  },
  shape: {
    borderRadius: 8,
  },
  spacing: 8,
  shadows: [
    'none',
    '0px 2px 4px rgba(0,0,0,0.2)',
    '0px 4px 8px rgba(0,0,0,0.2)',
    '0px 8px 16px rgba(0,0,0,0.2)',
    '0px 12px 24px rgba(0,0,0,0.2)',
    '0px 16px 32px rgba(0,0,0,0.2)',
    '0px 20px 40px rgba(0,0,0,0.2)',
    '0px 24px 48px rgba(0,0,0,0.2)',
    '0px 28px 56px rgba(0,0,0,0.2)',
    '0px 32px 64px rgba(0,0,0,0.2)',
    '0px 36px 72px rgba(0,0,0,0.2)',
    '0px 40px 80px rgba(0,0,0,0.2)',
    '0px 44px 88px rgba(0,0,0,0.2)',
    '0px 48px 96px rgba(0,0,0,0.2)',
    '0px 52px 104px rgba(0,0,0,0.2)',
    '0px 56px 112px rgba(0,0,0,0.2)',
    '0px 60px 120px rgba(0,0,0,0.2)',
    '0px 64px 128px rgba(0,0,0,0.2)',
    '0px 68px 136px rgba(0,0,0,0.2)',
    '0px 72px 144px rgba(0,0,0,0.2)',
    '0px 76px 152px rgba(0,0,0,0.2)',
    '0px 80px 160px rgba(0,0,0,0.2)',
    '0px 84px 168px rgba(0,0,0,0.2)',
    '0px 88px 176px rgba(0,0,0,0.2)',
    '0px 92px 184px rgba(0,0,0,0.2)',
  ],
  components: {
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          backgroundColor: alpha('#4CAF50', 0.2),
          borderRadius: 4,
          height: 6,
        },
        bar: {
          borderRadius: 4,
        },
      },
    },
  },
});

export default taskOverlayTheme; 