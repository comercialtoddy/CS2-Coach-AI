/**
 * Task Overlay Renderer
 * 
 * Entry point for the task overlay window.
 * Renders the TaskOverlayPage component into the DOM.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import TaskOverlayPage from '../pages/TaskOverlay';
import { socket } from '../UI/api/socket';

// Initialize socket.io client
socket.connect();

// Create root element
const container = document.getElementById('root');
if (!container) throw new Error('Failed to find root element');

// Create root and render
const root = ReactDOM.createRoot(container);
root.render(
  <React.StrictMode>
    <TaskOverlayPage />
  </React.StrictMode>
); 