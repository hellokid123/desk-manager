import { contextBridge, ipcRenderer } from 'electron';

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
  windowPosition: { x: number; y: number };
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

const electronAPI: ElectronAPI = {
  toggleLock: () => ipcRenderer.invoke('toggle-lock'),
  getLockState: () => ipcRenderer.invoke('get-lock-state'),
  showNotification: (title: string, body: string) =>
    ipcRenderer.invoke('show-notification', title, body),
  openPath: (filePath: string) => ipcRenderer.invoke('open-path', filePath),
  setOpacity: (opacity: number) => ipcRenderer.invoke('set-opacity', opacity),
  isDirectory: (filePath: string) => ipcRenderer.invoke('is-directory', filePath),
  getFileIcon: (filePath: string) => ipcRenderer.invoke('get-file-icon', filePath),
  saveAppData: (data: AppData) => ipcRenderer.invoke('save-app-data', data),
  loadAppData: () => ipcRenderer.invoke('load-app-data'),
  closeApp: () => ipcRenderer.invoke('close-app'),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
