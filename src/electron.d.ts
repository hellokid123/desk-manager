interface AppData {
  transparency: number;
  isLocked: boolean;
  containers: Array<{ id: string; name: string }>;
  todos: Array<{
    id: string;
    title: string;
    time: string;
    description: string;
    completed: boolean;
    deleted: boolean;
  }>;
  fileManagerHeight: number;
  windowSize: { width: number; height: number };
}

interface ElectronAPI {
  toggleLock: () => Promise<boolean>;
  getLockState: () => Promise<boolean>;
  showNotification: (title: string, body: string) => Promise<void>;
  openPath: (filePath: string) => Promise<void>;
  setOpacity: (opacity: number) => Promise<void>;
  isDirectory: (filePath: string) => Promise<boolean>;
  getFileIcon: (filePath: string) => Promise<string | null>;
  saveAppData: (data: AppData) => Promise<boolean>;
  loadAppData: () => Promise<AppData>;
  closeApp: () => Promise<void>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
