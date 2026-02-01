import { app, BrowserWindow, screen, ipcMain, Notification, shell } from 'electron';
import * as path from 'path';

let mainWindow: BrowserWindow | null = null;
let isLocked = false;
let userDragging = false;
let moveDebounceTimer: NodeJS.Timeout | null = null;
let lockedSize: { width: number; height: number } | null = null;
let isRestoringSize = false; // 防止循环恢复大小
// 仅在「未贴边」时更新，约束位置时用此尺寸，避免贴边时 getBounds 被系统改掉导致反方向变宽（锁定/解锁都会发生）
let lastFreeSize: { width: number; height: number } | null = null;

const applyLockState = () => {
  if (!mainWindow) return;
  const workArea = screen.getPrimaryDisplay().workAreaSize;

  const minWidth = 350;
  const minHeight = 500;
  const maxWidth = Math.floor(workArea.width / 2);
  const maxHeight = workArea.height;

  if (isLocked) {
    const { width, height } = mainWindow.getBounds();
    lockedSize = { width, height };
    mainWindow.setResizable(false);
    mainWindow.setMinimumSize(width, height);
    mainWindow.setMaximumSize(width, height);
    mainWindow.setMaximizable(false);
  } else {
    mainWindow.setResizable(true);
    mainWindow.setMinimumSize(minWidth, minHeight);
    mainWindow.setMaximumSize(maxWidth, maxHeight);
    mainWindow.setMaximizable(false);
    lockedSize = null;
  }
};

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 350,
    height: 700,
    x: screen.getPrimaryDisplay().workAreaSize.width - 350,
    y: 100,
    frame: false,
    transparent: false,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    alwaysOnTop: false,
    skipTaskbar: false,
    resizable: false,  // 默认不可调整大小
  });

  if (process.env.NODE_ENV === 'development') {
    // 开发环境：尝试连接到Vite服务器
    const devServers = [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:5176',
    ];

    // 尝试第一个端口，如果失败会自动重试
    mainWindow.loadURL(devServers[0]).catch(() => {
      // 如果主端口失败，尝试其他端口
      for (const url of devServers.slice(1)) {
        mainWindow!.loadURL(url).catch(() => {});
      }
    });

    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  applyLockState();

  lastFreeSize = { width: 350, height: 700 };
  mainWindow.setOpacity(1);

  mainWindow.on('resize', () => {
    if (!mainWindow || isLocked || isRestoringSize) return;
    const workArea = screen.getPrimaryDisplay().workAreaSize;
    const b = mainWindow.getBounds();
    const margin = 1;
    const atEdge =
      b.x < margin ||
      b.y < margin ||
      b.x + b.width > workArea.width - margin ||
      b.y + b.height > workArea.height - margin;
    if (atEdge && lastFreeSize) {
      isRestoringSize = true;
      mainWindow.setBounds({ x: b.x, y: b.y, width: lastFreeSize.width, height: lastFreeSize.height });
      setImmediate(() => { isRestoringSize = false; });
    } else {
      lastFreeSize = { width: b.width, height: b.height };
    }
  });

  let processingMove = false;

  mainWindow.on('move', () => {
    if (!mainWindow || processingMove) return;

    try {
      processingMove = true;

      const workArea = screen.getPrimaryDisplay().workAreaSize;
      const { x, y, width, height } = mainWindow.getBounds();

      const w = isLocked && lockedSize ? lockedSize.width : (lastFreeSize?.width ?? width);
      const h = isLocked && lockedSize ? lockedSize.height : (lastFreeSize?.height ?? height);
      const clampX = Math.max(0, Math.min(x, workArea.width - w));
      const clampY = Math.max(0, Math.min(y, workArea.height - h));
      const needsAdjust = clampX !== x || clampY !== y;

      if (needsAdjust) {
        mainWindow.setBounds({ x: clampX, y: clampY, width: w, height: h });
      } else {
        const margin = 2;
        const inside = x >= margin && y >= margin &&
          x + width <= workArea.width - margin && y + height <= workArea.height - margin;
        if (inside) lastFreeSize = { width, height };
      }

      userDragging = true;
      if (moveDebounceTimer) clearTimeout(moveDebounceTimer);
      moveDebounceTimer = setTimeout(() => { userDragging = false; }, 150);
    } finally {
      processingMove = false;
    }
  });

  mainWindow.on('maximize', () => {
    if (isLocked && mainWindow) {
      mainWindow.unmaximize();
    }
  });

  mainWindow.on('enter-full-screen', () => {
    if (isLocked && mainWindow) {
      mainWindow.setFullScreen(false);
    }
  });
};

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers
ipcMain.handle('toggle-lock', () => {
  isLocked = !isLocked;
  applyLockState();
  return isLocked;
});

ipcMain.handle('get-lock-state', () => {
  return isLocked;
});

ipcMain.handle('set-opacity', (event, opacity: number) => {
  if (mainWindow && typeof opacity === 'number') {
    mainWindow.setOpacity(Math.min(1, Math.max(0, opacity)));
  }
});

ipcMain.handle('show-notification', (event, title: string, body: string) => {
  new Notification({
    title,
    body,
    silent: false,
  }).show();
});

ipcMain.handle('open-path', async (event, filePath: string) => {
  if (!filePath) {
    return;
  }
  return shell.openPath(filePath);
});
