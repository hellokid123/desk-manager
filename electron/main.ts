import { app, BrowserWindow, screen, ipcMain, Notification, shell, nativeImage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// 设置缓存目录到应用数据目录
const cacheDir = path.join(app.getPath('userData'), 'cache');
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}
app.setPath('cache', cacheDir);

// 数据存储目录
const dataDir = path.join(app.getPath('userData'), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const appDataFile = path.join(dataDir, 'appdata.json');

// 数据存储模块
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

const defaultAppData: AppData = {
  transparency: 0,
  isLocked: false,
  containers: [{ id: '1', name: '文件区 1' }],
  todos: [],
  fileManagerHeight: 50,
  windowSize: { width: 350, height: 700 },
  windowPosition: { x: 1000, y: 100 },
};

const loadAppData = (): AppData => {
  try {
    if (fs.existsSync(appDataFile)) {
      const data = fs.readFileSync(appDataFile, 'utf-8');
      const parsedData = JSON.parse(data);
      // 合并默认值，确保所有必要的字段存在
      return {
        ...defaultAppData,
        ...parsedData,
        windowSize: parsedData.windowSize || defaultAppData.windowSize,
        windowPosition: parsedData.windowPosition || defaultAppData.windowPosition,
      };
    }
  } catch (error) {
    console.error('Failed to load app data:', error);
  }
  return defaultAppData;
};

const saveAppData = (data: AppData) => {
  try {
    fs.writeFileSync(appDataFile, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Failed to save app data:', error);
  }
};

let appData = loadAppData();

let mainWindow: BrowserWindow | null = null;
let isLocked = appData.isLocked;
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
  // 计算窗口位置，如果保存的位置超出屏幕范围则使用默认值
  const workArea = screen.getPrimaryDisplay().workAreaSize;
  let posX = appData.windowPosition.x;
  let posY = appData.windowPosition.y;

  // 验证位置是否有效
  if (posX < 0 || posX + appData.windowSize.width > workArea.width) {
    posX = workArea.width - appData.windowSize.width;
  }
  if (posY < 0 || posY + appData.windowSize.height > workArea.height) {
    posY = 100;
  }

  mainWindow = new BrowserWindow({
    width: appData.windowSize.width,
    height: appData.windowSize.height,
    x: posX,
    y: posY,
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
    // 生产环境：加载打包后的文件
    const indexPath = path.join(__dirname, '../dist/index.html');
    mainWindow.loadFile(indexPath).catch((err) => {
      console.error('Failed to load index.html:', err);
      console.error('Looking for file at:', indexPath);
      // 备选方案：尝试从app.asar.unpacked加载
      const asarPath = path.join(__dirname, '../../dist/index.html');
      mainWindow?.loadFile(asarPath).catch((err2) => {
        console.error('Failed to load from asar path:', err2);
      });
    });
  }

  applyLockState();

  lastFreeSize = { width: appData.windowSize.width, height: appData.windowSize.height };

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
  let saveConfigTimer: NodeJS.Timeout | null = null;

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

      // 保存窗口位置
      if (saveConfigTimer) clearTimeout(saveConfigTimer);
      saveConfigTimer = setTimeout(() => {
        const bounds = mainWindow!.getBounds();
        appData.windowPosition = { x: bounds.x, y: bounds.y };
        saveAppData(appData);
      }, 500);
    } finally {
      processingMove = false;
    }
  });

  // 监听窗口大小变化
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
      // 保存窗口大小
      if (saveConfigTimer) clearTimeout(saveConfigTimer);
      saveConfigTimer = setTimeout(() => {
        const bounds = mainWindow!.getBounds();
        appData.windowSize = { width: bounds.width, height: bounds.height };
        saveAppData(appData);
      }, 500);
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
  appData.isLocked = isLocked;
  saveAppData(appData);
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

ipcMain.handle('save-app-data', (event, data: AppData) => {
  appData = data;
  isLocked = data.isLocked;
  saveAppData(data);
  return true;
});

ipcMain.handle('load-app-data', () => {
  return appData;
});

ipcMain.handle('close-app', () => {
  if (mainWindow) {
    mainWindow.close();
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

ipcMain.handle('is-directory', async (event, filePath: string) => {
  try {
    const stats = await fs.promises.stat(filePath);
    return stats.isDirectory();
  } catch {
    return false;
  }
});

// 获取文件的系统图标 - 基于扩展名
const getFileIconByExtension = (filePath: string): string | null => {
  const ext = path.extname(filePath).toLowerCase();

  const iconMap: { [key: string]: string } = {
    // 应用程序
    '.exe': '⚙️',
    '.msi': '📦',
    '.app': '📱',
    '.apk': '📱',

    // 文档
    '.pdf': '📄',
    '.doc': '📝',
    '.docx': '📝',
    '.xls': '📊',
    '.xlsx': '📊',
    '.ppt': '🎞️',
    '.pptx': '🎞️',
    '.txt': '📄',
    '.rtf': '📄',

    // 图像
    '.jpg': '🖼️',
    '.jpeg': '🖼️',
    '.png': '🖼️',
    '.gif': '🖼️',
    '.bmp': '🖼️',
    '.svg': '🖼️',

    // 视频
    '.mp4': '🎬',
    '.avi': '🎬',
    '.mkv': '🎬',
    '.mov': '🎬',
    '.flv': '🎬',
    '.wmv': '🎬',
    '.webm': '🎬',

    // 音频
    '.mp3': '🎵',
    '.wav': '🎵',
    '.flac': '🎵',
    '.aac': '🎵',
    '.wma': '🎵',
    '.m4a': '🎵',

    // 压缩包
    '.zip': '🗜️',
    '.rar': '🗜️',
    '.7z': '🗜️',
    '.tar': '🗜️',
    '.gz': '🗜️',

    // 代码
    '.js': '</>',
    '.ts': '</>',
    '.py': '</>',
    '.java': '</>',
    '.cpp': '</>',
    '.c': '</>',
    '.html': '</>',
    '.css': '</>',
    '.json': '</>',
    '.xml': '</>',

    // 快捷方式
    '.lnk': '🔗',
  };

  return iconMap[ext] || null;
};

ipcMain.handle('get-file-icon', async (event, filePath: string) => {
  try {
    // 检查文件是否存在
    const exists = fs.existsSync(filePath);
    if (!exists) {
      console.warn(`File not found: ${filePath}`);
      return null;
    }

    try {
      // 使用 Electron 的 getFileIcon 获取文件图标
      const icon = await app.getFileIcon(filePath, { size: 'large' });
      if (icon && !icon.isEmpty()) {
        // 直接转换为 base64 data URL
        const pngBuffer = icon.toPNG();
        const base64 = pngBuffer.toString('base64');
        const dataUrl = `data:image/png;base64,${base64}`;
        console.log(`Got icon for ${path.basename(filePath)}, size: ${pngBuffer.length} bytes`);
        return dataUrl;
      }
    } catch (error) {
      console.warn(`Failed to get icon for ${filePath}:`, error);
    }

    // 降级方案：使用 emoji 图标
    const emoji = getFileIconByExtension(filePath);
    if (emoji) {
      console.log(`Using emoji icon for ${path.basename(filePath)}: ${emoji}`);
      return emoji;
    }

    console.log(`No icon found for: ${path.basename(filePath)}`);
    return null;
  } catch (error) {
    console.error(`Error getting icon for ${filePath}:`, error);
    return null;
  }
});
