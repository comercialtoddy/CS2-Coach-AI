import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';

interface Point {
  x: number;
  y: number;
}

interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ScreenshotSelectorProps {
  onSelect: (region: Region) => void;
  onCancel: () => void;
}

const ScreenshotSelector: React.FC<ScreenshotSelectorProps> = ({ onSelect, onCancel }) => {
  const [isSelecting, setIsSelecting] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [endPoint, setEndPoint] = useState<Point | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsSelecting(true);
    setStartPoint({ x: e.clientX, y: e.clientY });
    setEndPoint({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isSelecting) {
      setEndPoint({ x: e.clientX, y: e.clientY });
    }
  }, [isSelecting]);

  const handleMouseUp = useCallback(() => {
    if (startPoint && endPoint) {
      const region = {
        x: Math.min(startPoint.x, endPoint.x),
        y: Math.min(startPoint.y, endPoint.y),
        width: Math.abs(endPoint.x - startPoint.x),
        height: Math.abs(endPoint.y - startPoint.y)
      };
      onSelect(region);
    }
    setIsSelecting(false);
    setStartPoint(null);
    setEndPoint(null);
  }, [startPoint, endPoint, onSelect]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  }, [onCancel]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  const selectionStyle = React.useMemo(() => {
    if (!startPoint || !endPoint) return {};

    return {
      position: 'absolute' as const,
      left: Math.min(startPoint.x, endPoint.x),
      top: Math.min(startPoint.y, endPoint.y),
      width: Math.abs(endPoint.x - startPoint.x),
      height: Math.abs(endPoint.y - startPoint.y),
      border: '2px solid #00ff00',
      backgroundColor: 'rgba(0, 255, 0, 0.1)',
      pointerEvents: 'none' as const
    };
  }, [startPoint, endPoint]);

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        cursor: 'crosshair',
        zIndex: 9999
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {startPoint && endPoint && <div style={selectionStyle} />}
      <div
        style={{
          position: 'fixed',
          top: '10px',
          left: '50%',
          transform: 'translateX(-50%)',
          color: 'white',
          fontSize: '14px',
          textAlign: 'center',
          padding: '8px',
          borderRadius: '4px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)'
        }}
      >
        Click and drag to select an area. Press ESC to cancel.
      </div>
    </div>
  );
};

export function showScreenshotSelector(): Promise<Region> {
  return new Promise((resolve, reject) => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const cleanup = () => {
      const root = createRoot(container);
      root.unmount();
      document.body.removeChild(container);
    };

    const handleSelect = (region: Region) => {
      cleanup();
      resolve(region);
    };

    const handleCancel = () => {
      cleanup();
      reject(new Error('Selection cancelled'));
    };

    const root = createRoot(container);
    root.render(
      <ScreenshotSelector
        onSelect={handleSelect}
        onCancel={handleCancel}
      />
    );
  });
}

export default ScreenshotSelector; 