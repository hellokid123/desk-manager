interface ElectronAPI {
  toggleLock: () => Promise<boolean>;
  getLockState: () => Promise<boolean>;
  showNotification: (title: string, body: string) => Promise<void>;
  openPath: (filePath: string) => Promise<void>;
  setOpacity: (opacity: number) => Promise<void>;
  isDirectory: (filePath: string) => Promise<boolean>;
  getFileIcon: (filePath: string) => Promise<string | null>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
