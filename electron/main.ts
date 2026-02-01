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

// 贴边自动隐藏：贴边且鼠标离开则缩成一条，鼠标进入原区域则弹出
const EDGE_MARGIN = 8;
const HIDE_STRIP = 6;
const TRIGGER_ZONE = 60;
const HIDE_DELAY_MS = 100;
const AUTO_HIDE_CHECK_MS = 100;

let isAutoHidden = false;
let normalBoundsBeforeHide: { x: number; y: number; width: number; height: number } | null = null;
let hiddenEdge: 'left' | 'right' | 'top' | 'bottom' | null = null;
let hideDelayTimer: NodeJS.Timeout | null = null;
let autoHideInterval: NodeJS.Timeout | null = null;

const pointInRect = (px: number, py: number, x: number, y: number, w: number, h: number) =>
  px >= x && px <= x + w && py >= y && py <= y + h;

const runAutoHideCheck = () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const workArea = screen.getPrimaryDisplay().workAreaSize;
  const cursor = screen.getCursorScreenPoint();
  const mx = cursor.x;
  const my = cursor.y;
  const b = mainWindow.getBounds();

  if (isAutoHidden && normalBoundsBeforeHide && hiddenEdge) {
    let inZone = false;
    if (hiddenEdge === 'right') inZone = mx >= workArea.width - TRIGGER_ZONE;
    else if (hiddenEdge === 'left') inZone = mx <= TRIGGER_ZONE;
    else if (hiddenEdge === 'top') inZone = my <= TRIGGER_ZONE;
    else if (hiddenEdge === 'bottom') inZone = my >= workArea.height - TRIGGER_ZONE;
    if (inZone) {
      isAutoHidden = false;
      hiddenEdge = null;
      mainWindow.setMinimumSize(1, 1);
      mainWindow.setMaximumSize(10000, 10000);
      mainWindow.setBounds(normalBoundsBeforeHide);
      lastFreeSize = { width: normalBoundsBeforeHide.width, height: normalBoundsBeforeHide.height };
      normalBoundsBeforeHide = null;
      applyLockState();
    }
    return;
  }

  if (userDragging || isRestoringSize) return;

  const atRight = b.x + b.width >= workArea.width - EDGE_MARGIN;
  const atLeft = b.x <= EDGE_MARGIN;
  const atTop = b.y <= EDGE_MARGIN;
  const atBottom = b.y + b.height >= workArea.height - EDGE_MARGIN;
  const atAnyEdge = atRight || atLeft || atTop || atBottom;

  if (!atAnyEdge) {
    if (hideDelayTimer) {
      clearTimeout(hideDelayTimer);
      hideDelayTimer = null;
    }
    return;
  }

  const inWindow = pointInRect(mx, my, b.x, b.y, b.width, b.height);

  if (inWindow) {
    if (hideDelayTimer) {
      clearTimeout(hideDelayTimer);
      hideDelayTimer = null;
    }
    return;
  }

  if (!hideDelayTimer) {
    hideDelayTimer = setTimeout(() => {
      hideDelayTimer = null;
      if (!mainWindow || mainWindow.isDestroyed()) return;
      const bounds = mainWindow.getBounds();
      normalBoundsBeforeHide = { ...bounds };
      const w = workArea.width;
      const h = workArea.height;

      mainWindow.setMinimumSize(1, 1);
      mainWindow.setMaximumSize(10000, 10000);

      isAutoHidden = true;
      if (atRight) {
        hiddenEdge = 'right';
        mainWindow.setBounds({ x: w - HIDE_STRIP, y: bounds.y, width: HIDE_STRIP, height: bounds.height });
      } else if (atLeft) {
        hiddenEdge = 'left';
        mainWindow.setBounds({ x: 0, y: bounds.y, width: HIDE_STRIP, height: bounds.height });
      } else if (atTop) {
        hiddenEdge = 'top';
        mainWindow.setBounds({ x: bounds.x, y: 0, width: bounds.width, height: HIDE_STRIP });
      } else {
        hiddenEdge = 'bottom';
        mainWindow.setBounds({ x: bounds.x, y: h - HIDE_STRIP, width: bounds.width, height: HIDE_STRIP });
      }
    }, HIDE_DELAY_MS);
  }
};

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
    transparent: true,
    backgroundColor: '#00000000',
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

  mainWindow.on('resize', () => {
    if (!mainWindow || isLocked || isRestoringSize || isAutoHidden) return;
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
    if (!mainWindow || processingMove || isAutoHidden) return;

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
      if (hideDelayTimer) {
        clearTimeout(hideDelayTimer);
        hideDelayTimer = null;
      }
      if (moveDebounceTimer) clearTimeout(moveDebounceTimer);
      moveDebounceTimer = setTimeout(() => { userDragging = false; }, 150);
    } finally {
      processingMove = false;
    }
  });

  if (!autoHideInterval) {
    autoHideInterval = setInterval(runAutoHideCheck, AUTO_HIDE_CHECK_MS);
  }

  mainWindow.on('closed', () => {
    if (autoHideInterval) {
      clearInterval(autoHideInterval);
      autoHideInterval = null;
    }
    if (hideDelayTimer) {
      clearTimeout(hideDelayTimer);
      hideDelayTimer = null;
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
