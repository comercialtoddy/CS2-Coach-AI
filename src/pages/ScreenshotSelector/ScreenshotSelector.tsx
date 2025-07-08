import React from 'react';
import { ipcRenderer } from 'electron';
import ScreenshotSelector from '../../components/ScreenshotSelector';

const ScreenshotSelectorPage: React.FC = () => {
  const handleSelect = (region: { x: number; y: number; width: number; height: number }) => {
    ipcRenderer.send('screenshot-region-selected', region);
  };

  const handleCancel = () => {
    ipcRenderer.send('screenshot-selection-cancelled');
  };

  return (
    <ScreenshotSelector
      onSelect={handleSelect}
      onCancel={handleCancel}
    />
  );
};

export default ScreenshotSelectorPage; 