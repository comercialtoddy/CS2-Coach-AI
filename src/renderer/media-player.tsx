/**
 * Media Player Overlay Renderer
 * 
 * Entry point for the media player overlay window.
 * Renders the MediaPlayerPage component into the DOM.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import MediaPlayer from '../pages/MediaPlayer/MediaPlayer';
import { socket } from '../UI/api/socket';

// Initialize socket.io client
socket.connect();

// Create root element
const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

// Render the media player component
root.render(
  <React.StrictMode>
    <MediaPlayer />
  </React.StrictMode>
); 