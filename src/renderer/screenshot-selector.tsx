import React from 'react';
import { createRoot } from 'react-dom/client';
import ScreenshotSelector from '../pages/ScreenshotSelector';
import '../UI/global.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element not found');
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <ScreenshotSelector />
  </React.StrictMode>
); 