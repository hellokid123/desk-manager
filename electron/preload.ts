import { contextBridge, ipcRenderer } from 'electron';

interface ElectronAPI {
  toggleLock: () => Promise<boolean>;
  getLockState: () => Promise<boolean>;
  showNotification: (title: string, body: string) => Promise<void>;
  openPath: (filePath: string) => Promise<void>;
  setOpacity: (opacity: number) => Promise<void>;
  isDirectory: (filePath: string) => Promise<boolean>;
  getFileIcon: (filePath: string) => Promise<string | null>;
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
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
