/**
 * Task Overlay Page
 * 
 * Main page component for the task overlay window.
 * Wraps the TaskOverlay component with necessary providers and configuration.
 */

import React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { createTheme } from '@mui/material/styles';
import { TaskOverlay } from '../components/TaskOverlay';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#90caf9',
    },
    background: {
      default: 'transparent',
      paper: 'rgba(0, 0, 0, 0.8)',
    },
  },
});

const TaskOverlayPage: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <TaskOverlay theme={theme} />
    </ThemeProvider>
  );
};

export default TaskOverlayPage; 