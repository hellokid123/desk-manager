# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Desk Manager is an Electron + React desktop application for Windows that combines file management and todo list features with a compact widget-style interface. Key characteristics:
- Edge-snapping auto-hide functionality (collapses to a thin strip at screen edges)
- Window lock feature to prevent accidental resizing
- Resizable file/todo content split
- Persistent state storage
- Transparent UI with adjustable opacity
- Always starts with window centered on screen

## Development Commands

```bash
# Install dependencies
npm install

# Development mode (runs Vite dev server + Electron with hot reload)
npm run dev

# Build React and Electron for production
npm run build

# Package application with electron-builder
npm run package

# Build only React assets
npm run build:react

# Build only Electron main process
npm run build:electron

# Development React only (port 5173)
npm run dev:react

# Development Electron only (requires React server running)
npm run dev:electron
```

## Architecture Overview

### Process Architecture
- **Main Process** (`electron/main.ts`): Electron main thread handling window management, IPC, file operations, and persistence
- **Preload Script** (`electron/preload.ts`): Context bridge exposing safe IPC APIs to renderer
- **Renderer Process** (`src/App.tsx`): React application running in BrowserWindow

### Data Flow
1. React components manage UI state
2. `App.tsx` orchestrates state and persists to Electron via `window.electronAPI`
3. Main process saves to `~/.config/desk-manager/data/appdata.json`
4. On startup, App loads persisted state via `loadAppData()` IPC call

### Key State Management

**App.tsx** manages core state:
- `isLocked`: Window resize/move lock state
- `containers`: File manager card containers (currently single container used)
- `todos`: Todo items with completed/deleted flags, plus `order` field for drag-and-drop reordering
- `transparency`: Opacity slider (0-100)
- `fileManagerHeight`: Flex ratio for file/todo split (percentage)
- `showSettings`: Controls settings panel visibility
- `isInitialized`: Prevents persisting state during initial load (avoids overwriting saved data before it's loaded)

All state auto-saves to disk after each change (debounced for resize/move). The `isInitialized` flag ensures saves only begin after `loadAppData()` completes.

## Component Structure

### Main Components
- **TopBar**: Lock button, settings button, close button
- **FileManager**: File card grid display with add container button
- **FileCard**: Individual file/folder entry with icon, name, right-click menu
- **TodoList**: Tab-based view switching (pending/completed/deleted)
- **TodoForm**: Input form for creating new todos
- **TodoItem**: Todo entry with checkbox, edit, delete actions
- **SettingsPanel**: Opacity slider overlay
- **ResizeFrame**: Frameless window drag handles and resize areas

### Supporting Components
- **CardContainer**: Layout wrapper (currently minimal usage)

## Window Management

The main process implements sophisticated window behavior:

### Edge Snapping & Auto-Hide
- Window detects when snapped near screen edges (8px margin threshold)
- After 100ms delay without cursor in window, collapses to thin strip (6px width/height)
- Hovering over 60px trigger zone at edge expands window back
- Stored in variables: `isAutoHidden`, `normalBoundsBeforeHide`, `hiddenEdge`

### Resize Constraints
- Unlocked: min 350×500, max 50% width × full height
- Locked: fixed size (captured at lock time)
- Prevents resizing to screen edges via `lastFreeSize` tracking

### Persistence
- Window size saved on resize (500ms debounce)
- Position centered on each startup (no position persistence)
- Window always respects screen bounds

## Electron IPC Handlers

Core APIs exposed via preload script:

| Handler | Purpose |
|---------|---------|
| `toggle-lock` | Toggle window lock state |
| `get-lock-state` | Query current lock state |
| `set-opacity` | Apply window opacity (0-1) |
| `save-app-data` | Persist state to disk |
| `load-app-data` | Load state from disk |
| `close-app` | Exit application |
| `show-notification` | Show system notification |
| `open-path` | Open file/folder in explorer |
| `is-directory` | Check if path is directory |
| `get-file-icon` | Get system icon or emoji fallback |

## File Icons

Icons sourced via priority:
1. System icons from Electron's `app.getFileIcon()` → base64 PNG data URL
2. Fallback emoji map by file extension (code, documents, media, archives, etc.)
3. No icon if neither available

## Development Workflow

### Adding Features
1. Add React components in `src/components/`
2. Update `App.tsx` state and handlers as needed
3. Add IPC handlers in `electron/main.ts` if requiring main process access
4. Export handler via preload script `electron/preload.ts`
5. Call via `window.electronAPI` in React code

### File Paths
- Development: Electron loads from Vite dev server (`http://localhost:5173`)
- Production: Loads from `dist/index.html`
- Data storage: `${app.getPath('userData')}/data/appdata.json`

### Type Definitions
- App state types in `src/App.tsx` (interfaces for CardContainer, Todo)
- IPC types in `electron/preload.ts` (ElectronAPI interface)
- Keep types in sync across both sides

## Common Issues & Solutions

### Window not loading in dev
- Ensure Vite server running on port 5173
- Check `NODE_ENV=development` in electron dev script
- Dev tools auto-open to debug loading

### State not persisting
- Verify `loadAppData()` called in App useEffect
- Check data directory exists: `~/.config/desk-manager/data/`
- IPC handler `save-app-data` must be invoked after state changes

### Icons not showing
- File path must exist (checked in `get-file-icon`)
- Falls back to emoji if Windows doesn't provide system icon
- Check browser console and electron console for warnings

## Build Configuration

- **Vite** (`vite.config.ts`): Handles React/TS compilation, outputs to `dist/`
- **Electron TSC** (`electron/tsconfig.json`): Compiles main process to `dist/electron/`
- **electron-builder**: Packages dist files into NSIS installer

## Bug Fixes & Known Issues

### windowPosition 死代码
- `electron/preload.ts` 中的 `AppData` 接口定义了 `windowPosition: { x: number; y: number }` 字段
- 但主进程和渲染进程均未使用此字段（窗口每次启动都居中）
- 属于遗留代码，可安全移除

### 🔴 进行中: 拖拽文件图标无法正常显示 (2026-03-03)

**问题描述**：
- 从 Windows 桌面拖拽文件到窗口后，文件图标无法正常显示
- 已多次尝试修改仍未解决

**根因分析 - 发现以下多个问题**：

#### 问题1: `get-file-icon` 文件不存在时跳过 emoji 降级（关键 bug）
- **位置**: `electron/main.ts:546-549`
- `fs.existsSync(filePath)` 如果返回 false，直接 `return null`
- **完全跳过了** 567-572 行的 emoji 降级逻辑
- 导致：文件路径异常时，图标直接为 null，FileCard 只显示默认 📄

#### 问题2: CardContainer 的 cards 状态未接入持久化
- **位置**: `src/components/CardContainer.tsx:19`
- `cards` 存储在组件本地 `useState` 中，不在 App.tsx 管理
- App.tsx 的 `containers` 只保存 `{id, name}`，不包含文件卡片数据
- 导致：**每次重启应用，所有拖入的文件卡片全部丢失**

#### 问题3: img 和 emoji 同时渲染导致视觉异常
- **位置**: `src/components/FileCard.tsx:67-87`
- `imageLoaded` 初始为 `false`，img 和 📄 emoji 同时出现在 flex 容器中
- img 即使不可见也占据空间，与 emoji 并排显示
- 如果 `app.getFileIcon()` 返回的是透明/空白图标，`onLoad` 会触发但图片视觉上为空

#### 问题4: 图标顺序获取，多文件拖入时延迟累积
- **位置**: `src/components/CardContainer.tsx:31-75`
- `for...of` 循环中逐个 `await` 获取图标
- 拖入 10 个文件 = 10 次串行 IPC 调用 ≈ 1-2 秒延迟
- 应改用 `Promise.all()` 并行获取

#### 问题5: Windows 路径兼容性
- `app.getFileIcon()` 对 .lnk 快捷方式、Unicode 文件名、特殊路径可能失败
- 代码中无 `path.normalize()` 路径规范化处理

**技术栈评估**：
- Electron 的 `app.getFileIcon()` 是对 Windows Shell API 的封装，理论上可行
- 但 base64 data URL 经过 IPC 传输 → React 渲染的链路较长，中间环节多
- 核心问题不是技术栈，而是错误处理和状态管理的实现细节
- 如果 Electron 方案始终无法稳定获取图标，可考虑用原生语言（C#/WPF 或 Rust/Tauri）重构

**可选修复方案（按优先级）**：

| 方案 | 方法 | 改动量 | 说明 |
|------|------|--------|------|
| A | `nativeImage.toDataURL()` 替代手动 base64 | 1 行 | 用 Chromium 内置编码，可能处理边界情况更好 |
| B | 自定义协议 `protocol.handle` | 中等 | 注册 `file-icon://` 协议，绕过 IPC base64，浏览器原生加载图片，Electron 官方推荐模式 |
| C | `sharp` + `toBitmap()` 兜底 | 中等 | 已知 bug: `toPNG()` 可能返回空 buffer，但 `toBitmap()` 有效；用 sharp 转换原始像素数据 |
| D | PowerShell `ExtractAssociatedIcon` | 小 | .NET API 可靠，能处理 .lnk，但每次 200-500ms 较慢 |
| E | `extract-file-icon` 原生插件 | 小 | 直接调 Windows API，但包已 6 年未维护 |

---

**修复尝试记录**：

| 次数 | 日期 | 方法 | 结果 |
|------|------|------|------|
| 1 | 2026-02-06 | 移除 `display: none` 条件，改用 emoji fallback | 部分修复，img onLoad 能触发了，但图标仍有异常 |
| 2 | 2026-03-03 | 方案A: `nativeImage.toDataURL()` 替代手动 base64 | 不可行，图标仍无法正常显示 |

**结论：决定用 Tauri 重构整个项目。详见 [refactor.md](./refactor.md)**

## Notes

- Window is frameless (`frame: false`) - custom title bar via TopBar component
- Transparent background (`transparent: true`) - background set via App.tsx inline style
- Always-on-top disabled (`alwaysOnTop: false`) - normal window stacking
- Context isolation enabled for security - only electronAPI exposed to renderer
- **重构计划**：项目将从 Electron + React 迁移到 Tauri + React，详细方案见 `refactor.md`
