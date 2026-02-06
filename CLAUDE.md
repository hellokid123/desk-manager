# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Desk Manager is an Electron + React desktop application for Windows that combines file management and todo list features with an always-on-top widget interface. Key characteristics:
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
- `todos`: Todo items with completed/deleted flags for filtering
- `transparency`: Opacity slider (0-100)
- `fileManagerHeight`: Flex ratio for file/todo split (percentage)

All state auto-saves to disk after each change (debounced for resize/move).

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

### 已解决: 文件图标无法显示问题 (File Icon Display Issue) - 2026-02-06

**问题描述**：
- FileCard 组件收到正确的 base64 data URL（console 显示正常）
- 但图标在UI中始终不显示

**根本原因**：
- FileCard.tsx 第75行 CSS 中 `display: imageLoaded ? 'block' : 'none'`
- 初始状态 `imageLoaded = false`，导致 `<img>` 被设置为 `display: none`
- 因为图片被隐藏，某些浏览器不会触发 `onLoad` 事件，陷入死循环
- `imageLoaded` 永远保持 false，图片永久隐藏

**解决方案**：
- 移除了 `display` 属性的条件判断
- 改用 `{!imageLoaded && <span>...</span>}` 在加载失败时显示 emoji 备用方案
- 图片现在总是可见，加载完成后会显示，加载失败时显示备用 emoji

**提交**：修改 src/components/FileCard.tsx

## Notes

- Window is frameless (`frame: false`) - custom title bar via TopBar component
- Transparent background (`transparent: true`) - background set via App.tsx inline style
- Always-on-top disabled (`alwaysOnTop: false`) - normal window stacking
- Context isolation enabled for security - only electronAPI exposed to renderer
