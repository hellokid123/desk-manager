import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  toggleLock: () => ipcRenderer.invoke('toggle-lock'),
  getLockState: () => ipcRenderer.invoke('get-lock-state'),
  showNotification: (title: string, body: string) =>
    ipcRenderer.invoke('show-notification', title, body),
  openPath: (filePath: string) => ipcRenderer.invoke('open-path', filePath),
  setOpacity: (opacity: number) => ipcRenderer.invoke('set-opacity', opacity),
});
