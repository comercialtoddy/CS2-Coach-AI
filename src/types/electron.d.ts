export interface IElectronAPI {
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  
  openHud: () => void;
  closeHud: () => void;
  
  openAgentOverlay: () => void;
  closeAgentOverlay: () => void;
  
  openTaskOverlay: () => void;
  closeTaskOverlay: () => void;
  showTaskOverlay: () => void;
  hideTaskOverlay: () => void;
  updateTask: (data: {
    taskId: string;
    title: string;
    description: string;
    progress: {
      current: number;
      target: number;
      percentage: number;
    };
    status: 'active' | 'completed' | 'failed';
  }) => void;
  updateTaskProgress: (progress: {
    current: number;
    target: number;
    percentage: number;
  }) => void;
  updateTaskStatus: (status: {
    status: 'active' | 'completed' | 'failed';
  }) => void;
  
  on: (channel: string, callback: Function) => void;
  off: (channel: string, callback: Function) => void;
  
  sendFrameAction: (action: string) => void;
  openExternalLink: (url: string) => void;
  captureScreenshot: (options?: {
    displayId?: string;
    region?: { x: number; y: number; width: number; height: number };
    outputPath?: string;
    useSelector?: boolean;
  }) => Promise<{
    imagePath: string;
    timestamp: string;
    success: boolean;
    error?: string;
  }>;
  selectScreenshotRegion: () => Promise<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}

declare global {
  interface Window {
    electron: IElectronAPI;
  }
} 