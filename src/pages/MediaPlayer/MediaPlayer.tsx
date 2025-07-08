import React, { useEffect, useState, useRef } from 'react';
import { socket } from '../../UI/api/socket';

interface MediaItem {
  type: 'image' | 'video';
  path: string;
  timestamp: number;
}

const MediaPlayer: React.FC = () => {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isInteractive, setIsInteractive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const autoHideTimerRef = useRef<NodeJS.Timeout>();

  const currentItem = mediaItems[currentIndex];

  useEffect(() => {
    // Listen for media updates
    socket.on('update-media', (data: MediaItem) => {
      setMediaItems(prev => [...prev, data]);
      setCurrentIndex(prev => prev + 1);
      setIsVisible(true);
      
      // Clear any existing auto-hide timer
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
      }

      // Auto-hide after 5 seconds for images
      if (data.type === 'image') {
        autoHideTimerRef.current = setTimeout(() => setIsVisible(false), 5000);
      }
    });

    // Listen for animation events
    socket.on('animate-in', () => setIsVisible(true));
    socket.on('animate-out', () => setIsVisible(false));

    return () => {
      socket.off('update-media');
      socket.off('animate-in');
      socket.off('animate-out');
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
      }
    };
  }, []);

  // Handle video playback end
  const handleVideoEnd = () => {
    setIsVisible(false);
  };

  // Handle mouse enter/leave for controls
  const handleMouseEnter = () => {
    window.api.setMediaPlayerInteractive(true);
    setIsInteractive(true);
    // Clear auto-hide timer when user interacts
    if (autoHideTimerRef.current) {
      clearTimeout(autoHideTimerRef.current);
    }
  };

  const handleMouseLeave = () => {
    window.api.setMediaPlayerInteractive(false);
    setIsInteractive(false);
    // Restart auto-hide timer if current item is an image
    if (currentItem?.type === 'image') {
      autoHideTimerRef.current = setTimeout(() => setIsVisible(false), 5000);
    }
  };

  // Handle manual close
  const handleClose = () => {
    setIsVisible(false);
    window.api.hideMediaPlayer();
  };

  // Handle navigation
  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setIsVisible(true);
      // Reset video if navigating to a video
      if (videoRef.current && mediaItems[currentIndex - 1].type === 'video') {
        videoRef.current.currentTime = 0;
      }
    }
  };

  const handleNext = () => {
    if (currentIndex < mediaItems.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsVisible(true);
      // Reset video if navigating to a video
      if (videoRef.current && mediaItems[currentIndex + 1].type === 'video') {
        videoRef.current.currentTime = 0;
      }
    }
  };

  // Clear media history
  const handleClearHistory = () => {
    setMediaItems([]);
    setCurrentIndex(0);
    setIsVisible(false);
    window.api.hideMediaPlayer();
  };

  if (!currentItem || !isVisible) {
    return null;
  }

  return (
    <div 
      className={`fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Controls overlay */}
      {isInteractive && (
        <div className="absolute inset-0 flex items-center justify-between p-4">
          {/* Previous button */}
          <button
            className={`text-white hover:text-gray-300 ${
              currentIndex > 0 ? 'opacity-100' : 'opacity-50 cursor-not-allowed'
            }`}
            onClick={handlePrevious}
            disabled={currentIndex === 0}
          >
            ←
          </button>

          {/* Next button */}
          <button
            className={`text-white hover:text-gray-300 ${
              currentIndex < mediaItems.length - 1 ? 'opacity-100' : 'opacity-50 cursor-not-allowed'
            }`}
            onClick={handleNext}
            disabled={currentIndex === mediaItems.length - 1}
          >
            →
          </button>
        </div>
      )}

      {/* Top controls */}
      {isInteractive && (
        <div className="absolute top-2 right-2 flex gap-2 z-10">
          <button
            className="text-white hover:text-gray-300"
            onClick={handleClearHistory}
            title="Clear history"
          >
            ⟲
          </button>
          <button
            className="text-white hover:text-gray-300"
            onClick={handleClose}
            title="Close"
          >
            ✕
          </button>
        </div>
      )}

      {/* Media content */}
      <div className="w-full h-full flex items-center justify-center">
        {currentItem.type === 'image' ? (
          <img
            src={currentItem.path}
            alt="Captured screenshot"
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <video
            ref={videoRef}
            src={currentItem.path}
            className="max-w-full max-h-full"
            controls={isInteractive}
            autoPlay
            onEnded={handleVideoEnd}
          />
        )}
      </div>

      {/* Bottom info */}
      {isInteractive && (
        <div className="absolute bottom-2 left-2 right-2 flex justify-between text-white text-sm opacity-75">
          <div>{new Date(currentItem.timestamp).toLocaleTimeString()}</div>
          <div>{`${currentIndex + 1} / ${mediaItems.length}`}</div>
        </div>
      )}
    </div>
  );
};

export default MediaPlayer; 