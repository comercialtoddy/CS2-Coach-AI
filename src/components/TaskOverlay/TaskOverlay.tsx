/**
 * Task Overlay Component
 * 
 * A minimalist overlay that displays the current task, progress, and status
 * in a clear and non-intrusive manner during gameplay.
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { socket } from '../../UI/api/socket';
import { LinearProgress } from '@mui/material';
import { styled } from '@mui/material/styles';
import { Theme } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';

// Styled components
const OverlayContainer = styled(motion.div)(({ theme }) => ({
  position: 'relative',
  width: '100%',
  maxWidth: 400,
  padding: theme.spacing(2),
  backgroundColor: alpha(theme.palette.background.paper, 0.85),
  borderRadius: theme.shape.borderRadius,
  backdropFilter: 'blur(8px)',
  boxShadow: theme.shadows[4],
  overflow: 'hidden',
  '&:hover': {
    backgroundColor: alpha(theme.palette.background.paper, 0.95),
  }
}));

const TaskTitle = styled('h3')(({ theme }) => ({
  margin: 0,
  marginBottom: theme.spacing(0.5),
  fontSize: '1rem',
  fontWeight: 600,
  color: theme.palette.text.primary,
}));

const TaskDescription = styled('p')(({ theme }) => ({
  margin: 0,
  marginBottom: theme.spacing(1.5),
  fontSize: '0.875rem',
  color: theme.palette.text.secondary,
  lineHeight: 1.4,
}));

const ProgressContainer = styled('div')(({ theme }) => ({
  marginBottom: theme.spacing(1),
}));

const ProgressText = styled('div')(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: theme.spacing(0.5),
  fontSize: '0.75rem',
  color: theme.palette.text.secondary,
}));

const StatusIndicator = styled('div')<{ status: 'active' | 'completed' | 'failed' }>(
  ({ theme, status }) => ({
    display: 'flex',
    alignItems: 'center',
    fontSize: '0.75rem',
    color: status === 'completed' 
      ? theme.palette.success.main 
      : status === 'failed'
      ? theme.palette.error.main
      : theme.palette.info.main,
    '&::before': {
      content: '""',
      display: 'inline-block',
      width: 8,
      height: 8,
      marginRight: theme.spacing(0.5),
      borderRadius: '50%',
      backgroundColor: 'currentColor',
    }
  })
);

// Animation variants
const overlayVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 50,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 30,
    },
  },
  exit: {
    opacity: 0,
    y: -50,
    scale: 0.95,
    transition: {
      duration: 0.2,
    },
  },
};

// Component props
interface TaskOverlayProps {
  theme: Theme;
}

// Task data interface
interface TaskData {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'completed' | 'failed';
  progress: {
    current: number;
    target: number;
    percentage: number;
  };
}

export const TaskOverlay: React.FC<TaskOverlayProps> = ({ theme }) => {
  const [task, setTask] = useState<TaskData | null>(null);
  const [isVisible] = useState(true);

  useEffect(() => {
    socket.on('taskUpdate', (data: TaskData) => {
      setTask({
        id: data.id,
        title: data.title,
        description: data.description,
        status: data.status as 'active' | 'completed' | 'failed',
        progress: data.progress
      });
    });

    return () => {
      socket.off('taskUpdate');
    };
  }, []);

  if (!task) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <OverlayContainer
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <TaskTitle>{task.title}</TaskTitle>
          <TaskDescription>{task.description}</TaskDescription>
          
          <ProgressContainer>
            <ProgressText>
              <span>Progress</span>
              <span>{task.progress.current} / {task.progress.target}</span>
            </ProgressText>
            <LinearProgress
              variant="determinate"
              value={task.progress.percentage}
              sx={{
                height: 6,
                borderRadius: 3,
                backgroundColor: alpha(theme.palette.primary.main, 0.2),
                '& .MuiLinearProgress-bar': {
                  borderRadius: 3,
                  backgroundColor: task.status === 'completed'
                    ? theme.palette.success.main
                    : task.status === 'failed'
                    ? theme.palette.error.main
                    : theme.palette.primary.main,
                }
              }}
            />
          </ProgressContainer>

          <StatusIndicator status={task.status}>
            {task.status === 'completed' ? 'Completed'
              : task.status === 'failed' ? 'Failed'
              : 'In Progress'
            }
          </StatusIndicator>
        </OverlayContainer>
      )}
    </AnimatePresence>
  );
};

export default TaskOverlay; 