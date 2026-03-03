# Desk Manager 重构计划：Electron → Tauri

> 本文档供 Claude Code 阅读，用于指导从 Electron + React 到 Tauri + React 的完整重构。

---

## 一、项目原始需求

Desk Manager 是一个 Windows 桌面小组件应用，包含文件管理和待办事项两大功能，以紧凑窗口形式常驻桌面。

### 1.1 窗口行为

| 需求 | 详细说明 |
|------|----------|
| 无边框窗口 | 不使用系统标题栏，自定义 TopBar（标题 + 锁定/设置/关闭按钮） |
| 透明背景 | 窗口背景 `rgba(255,255,255, dynamic)`，用户可调节透明度 0-100% |
| 窗口锁定 | 锁定后禁止拖动和缩放，边框变为蓝色发光 |
| 边缘吸附自动隐藏 | 靠近屏幕边缘（8px）后自动缩成 6px 细条；鼠标进入 60px 触发区展开 |
| 居中启动 | 每次启动窗口在主屏幕居中，不保存位置 |
| 尺寸约束 | 解锁时最小 350×500，最大为屏幕宽度的 50% × 全屏高度 |
| 尺寸持久化 | 窗口大小保存到磁盘（500ms 防抖），启动时恢复 |

### 1.2 文件管理

| 需求 | 详细说明 |
|------|----------|
| 拖拽添加 | 从 Windows 桌面/资源管理器拖拽文件或文件夹到窗口 |
| 文件图标 | 显示 Windows 系统原生图标（当前使用 Electron `app.getFileIcon()`） |
| 文件夹图标 | 固定显示 📁 emoji |
| 双击打开 | 双击文件卡片，用系统默认程序打开 |
| 右键菜单 | 右键文件卡片显示「删除」选项 |
| 卡片布局 | 纵向列表排列，每项 40px 高，图标 32×32 + 文件名 |

### 1.3 待办事项

| 需求 | 详细说明 |
|------|----------|
| 创建任务 | 输入标题（必填）和描述（可选），自动记录当前时间 |
| 编辑任务 | 点击标题进入编辑模式，可修改标题和描述 |
| 标记完成 | 点击 checkbox 标记完成，标题划线 + 降低透明度 |
| 软删除 | 右键「删除」设置 `deleted: true`，可在已删除分类中恢复 |
| 三分类标签页 | 待办（未完成未删除）/ 已完成（completed=true）/ 已删除（deleted=true） |
| 拖拽排序 | 待办标签页中可拖拽调整任务顺序（交换 order 值） |
| 时间提醒 | 每 60 秒检查一次，距截止时间 ≤5 分钟时发送系统通知 |
| 紧急高亮 | 距截止时间 ≤1 小时时，卡片显示橙色边框和暖色背景 |

### 1.4 布局与设置

| 需求 | 详细说明 |
|------|----------|
| 可调节分隔 | 文件区和待办区之间有可拖拽分隔线（6px），范围 20%-80% |
| 设置面板 | 覆盖层显示透明度滑块（0-100） |
| 数据持久化 | 所有状态自动保存到 JSON 文件：透明度、锁定状态、容器列表、待办事项、分隔比例、窗口大小 |

### 1.5 视觉设计

- 整体圆角 12px，卡片/面板 8-10px，按钮 4-6px
- 主题色：蓝色 `rgba(100,150,255,*)`、绿色 `#4CAF50`、橙色 `rgba(255,150,50,*)`、红色 `#d32f2f`
- 半透明毛玻璃效果：TopBar 使用 `backdrop-filter: blur(10px)`
- 过渡动画统一 `0.2s ease`
- 字体：系统字体栈 `-apple-system, 'Segoe UI', ...`
- 自定义滚动条：6px 宽，圆角 3px

---

## 二、为什么要重构

### 2.1 文件图标无法稳定显示（核心问题）

Electron 的 `app.getFileIcon()` 获取 Windows 系统图标并以 base64 data URL 传递到 React 渲染的方案，经过多次修复仍无法正常工作：

| 次数 | 方法 | 结果 |
|------|------|------|
| 1 | 移除 `display: none` 条件，改用 emoji fallback | img onLoad 能触发了，但图标仍有异常 |
| 2 | `nativeImage.toDataURL()` 替代手动 base64 拼接 | 不可行，图标仍无法正常显示 |

**已知问题链路**：
1. `app.getFileIcon()` → 可能返回空 buffer 或透明图标（已知 Electron bug）
2. 图标通过 IPC 以 base64 字符串传输 → 中间环节多，出错难排查
3. React `<img src="data:...">` 渲染 → imageLoaded 状态与实际显示不同步
4. 文件不存在时直接 return null，跳过 emoji 降级

### 2.2 安装包体积过大

Electron 打包后安装包 ~85MB（捆绑完整 Chromium + Node.js），对于一个桌面小工具来说过于臃肿。

### 2.3 内存占用高

Electron 应用空闲时占 200-300MB 内存，不适合「常驻桌面」的小工具场景。

---

## 三、技术选型：为什么选 Tauri

### 3.1 方案对比

| | Electron (当前) | Tauri | C# WPF |
|---|---|---|---|
| 安装包大小 | ~85 MB | **~2-5 MB** | ~2-3 MB (需系统 .NET) |
| 内存占用 | 200-300 MB | **30-40 MB** | 20-30 MB |
| 启动速度 | 1-2 秒 | **< 0.5 秒** | < 0.5 秒 |
| 前端代码复用 | - | **可直接复用 React + TS** | 需 XAML 全部重写 |
| Windows 图标获取 | `app.getFileIcon()` 不稳定 | Rust `windows` crate 直接调用 `SHGetFileInfo` | `ExtractAssociatedIcon()` 一行搞定 |
| 渲染引擎 | 捆绑 Chromium | 系统 WebView2 (Win10/11 自带) | 原生 WPF 渲染 |
| 学习成本 | 已掌握 | 需学 Rust（后端部分） | 需学 C# + XAML |

### 3.2 选择 Tauri 的理由

1. **安装包缩小 ~95%**：从 85MB 降到 2-5MB，用系统自带的 WebView2 而不是捆绑 Chromium
2. **前端代码可大量复用**：现有的 React 组件、CSS 样式、TypeScript 类型定义可以直接迁移
3. **Rust 后端直接调用 Windows API**：通过 `windows` crate 调用 `SHGetFileInfo` 获取系统图标，不再依赖 Electron 的封装层
4. **内存占用降低 ~85%**：从 200-300MB 降到 30-40MB，适合常驻桌面小工具
5. **Tauri v2 功能完备**：支持无边框窗口、透明背景、系统托盘、自定义协议等项目需要的所有特性

### 3.3 Tauri 文件图标方案

**方案：自定义协议 `file-icon://` + Rust 直接调用 Windows API**

```
渲染进程: <img src="file-icon:///C:/path/to/file.txt">
    ↓ (浏览器原生请求，无 IPC)
Tauri 主进程: protocol handler
    ↓ (Rust 直接调用)
Windows API: SHGetFileInfo → HICON → PNG bytes
    ↓ (二进制响应，无 base64)
渲染进程: 浏览器原生图片渲染
```

相比 Electron 方案的优势：
- 无 IPC base64 传输开销
- 无 NativeImage 中间转换
- Rust 直接操作 Windows 内存，无 Node.js GC 干扰
- 浏览器原生处理图片加载和缓存

---

## 四、模块拆分与复用评估

### 4.1 可直接复用的前端代码

以下 React 组件和样式文件可以**基本不改**地迁移到 Tauri 项目：

| 文件 | 说明 | 迁移改动 |
|------|------|----------|
| `src/components/TodoList.tsx` | 待办事项列表（标签页、拖拽排序） | 无需改动 |
| `src/components/TodoItem.tsx` | 待办事项条目（显示、编辑、右键菜单） | 无需改动 |
| `src/components/TodoForm.tsx` | 任务输入表单 | 无需改动 |
| `src/components/SettingsPanel.tsx` | 设置面板（透明度滑块） | 无需改动 |
| `src/components/TopBar.tsx` | 顶部栏（锁定/设置/关闭按钮） | 替换 `window.electronAPI` 为 Tauri `invoke` |
| `src/components/FileManager.tsx` | 文件管理器容器 | 无需改动 |
| `src/components/FileCard.tsx` | 文件卡片 | 图标 src 改为 `file-icon://` 协议 URL |
| `src/App.tsx` | 主状态管理 | 替换 `window.electronAPI` 为 Tauri `invoke` |
| `src/App.css` | 主布局样式 | 无需改动 |
| `src/index.css` | 全局样式 | 无需改动 |
| 所有 `*.css` 组件样式 | 视觉设计 | 无需改动 |

### 4.2 需要适配的前端代码

| 文件 | 改动内容 |
|------|----------|
| `src/App.tsx` | `window.electronAPI.xxx()` → Tauri `invoke('xxx', {...})` |
| `src/components/TopBar.tsx` | `electronAPI.closeApp()` → Tauri `appWindow.close()` |
| `src/components/FileCard.tsx` | data URL 图标 → `file-icon://` 协议 URL；移除 `imageLoaded` 状态 |
| `src/components/CardContainer.tsx` | 1. 拖拽获取文件路径方式适配 Tauri；2. 图标 URL 改为 `file-icon://`；3. cards 状态提升到 App.tsx 做持久化 |
| `src/components/ResizeFrame.tsx` | Electron 的无边框缩放改为 Tauri 的 `startDragging()` / `startResizing()` API |

### 4.3 需要用 Rust 重写的后端模块

| 模块 | Electron 原实现 | Tauri Rust 实现 |
|------|-----------------|-----------------|
| 窗口管理 | `electron/main.ts` BrowserWindow 配置 | `tauri.conf.json` + Rust `WindowBuilder` |
| 边缘吸附 & 自动隐藏 | main.ts 中 JS 实现（~150 行） | Rust 实现，调用 `GetCursorPos` / `SetWindowPos` Windows API |
| 文件图标获取 | `app.getFileIcon()` → base64 | Rust `SHGetFileInfo` → PNG → 自定义协议二进制响应 |
| 数据持久化 | `fs.readFileSync/writeFileSync` JSON | Tauri `tauri-plugin-store` 或 Rust `serde_json` + `fs` |
| 系统通知 | Electron `Notification` | Tauri `tauri-plugin-notification` |
| 打开文件 | `shell.openPath()` | Tauri `tauri-plugin-shell` 的 `open()` |
| 窗口透明度 | `mainWindow.setOpacity()` | Tauri `WebviewWindow::set_opacity()` |
| 窗口锁定 | `setResizable(false)` + `setMovable(false)` | Tauri `set_resizable(false)` + 自定义逻辑 |
| 检查文件夹 | `fs.promises.stat().isDirectory()` | Rust `std::fs::metadata().is_dir()` |

### 4.4 新建的 Tauri 项目结构

```
desk-manager/
├── src/                          # 前端代码（从 Electron 版迁移）
│   ├── components/               # React 组件（大部分直接复用）
│   │   ├── TopBar.tsx
│   │   ├── FileManager.tsx
│   │   ├── FileCard.tsx          # 改用 file-icon:// 协议
│   │   ├── CardContainer.tsx     # 适配 Tauri 拖拽 + 状态提升
│   │   ├── TodoList.tsx          # 直接复用
│   │   ├── TodoItem.tsx          # 直接复用
│   │   ├── TodoForm.tsx          # 直接复用
│   │   ├── SettingsPanel.tsx     # 直接复用
│   │   └── ResizeFrame.tsx       # 适配 Tauri 窗口 API
│   ├── App.tsx                   # 适配 Tauri invoke
│   ├── App.css                   # 直接复用
│   ├── main.tsx                  # 直接复用
│   └── index.css                 # 直接复用
├── src-tauri/                    # Tauri Rust 后端
│   ├── src/
│   │   ├── main.rs              # 应用入口
│   │   ├── lib.rs               # Tauri setup、插件注册、IPC commands
│   │   ├── commands/
│   │   │   ├── mod.rs
│   │   │   ├── file_icon.rs     # Windows SHGetFileInfo 图标获取
│   │   │   ├── file_ops.rs      # is_directory、open_path
│   │   │   ├── app_data.rs      # 数据持久化（load/save）
│   │   │   └── window.rs        # 锁定、透明度、边缘吸附
│   │   └── protocol.rs          # file-icon:// 自定义协议处理
│   ├── Cargo.toml               # Rust 依赖
│   ├── tauri.conf.json          # Tauri 窗口配置
│   └── icons/                   # 应用图标
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## 五、数据结构（保持不变）

### 5.1 AppData（持久化到 JSON）

```typescript
interface AppData {
  transparency: number           // 0-100
  isLocked: boolean
  containers: CardContainer[]    // 文件容器列表
  todos: Todo[]                  // 所有待办事项
  fileManagerHeight: number      // 20-80 (百分比)
  windowSize: { width: number; height: number }
}
```

### 5.2 Todo

```typescript
interface Todo {
  id: string
  title: string
  time: string            // ISO datetime "YYYY-MM-DDTHH:mm"
  description: string
  completed: boolean
  deleted: boolean
  order: number           // 仅待办标签页有效
}
```

### 5.3 CardContainer（需扩展）

```typescript
// 当前结构（仅存 id 和 name，cards 在组件本地状态，不持久化）
interface CardContainer {
  id: string
  name: string
}

// 重构后（cards 纳入持久化）
interface CardContainer {
  id: string
  name: string
  cards: FileCard[]
}

interface FileCard {
  id: string
  name: string
  type: 'file' | 'folder'
  path: string
}
// 注意：iconPath 不再存储，由 file-icon:// 协议根据 path 实时获取
```

---

## 六、Rust 关键实现要点

### 6.1 文件图标（核心）

使用 `windows` crate 调用 `SHGetFileInfoW`：

```rust
use windows::Win32::UI::Shell::{SHGetFileInfoW, SHFILEINFOW, SHGFI_ICON, SHGFI_LARGEICON};
use windows::Win32::UI::WindowsAndMessaging::DestroyIcon;

// 1. 调用 SHGetFileInfoW 获取 HICON
// 2. 将 HICON 转为 BITMAP（GetIconInfo + GetDIBits）
// 3. 将 BGRA 像素数据编码为 PNG（image crate）
// 4. 通过自定义协议以 image/png 二进制响应
// 5. 调用 DestroyIcon 释放资源
```

### 6.2 自定义协议

在 `tauri::Builder` 中注册：

```rust
.register_asynchronous_uri_scheme_protocol("file-icon", |_ctx, request, responder| {
    // 解析路径 → 获取图标 → 返回 PNG 二进制 Response
})
```

前端使用：
```html
<img src="file-icon://localhost/C:/path/to/file.txt" />
```

### 6.3 边缘吸附

Tauri 的窗口 API + Windows `GetCursorPos`：

```rust
// 定时检查窗口位置和鼠标位置
// 窗口靠近屏幕边缘 → 记录原始位置 → 缩小到 6px
// 鼠标进入触发区 → 恢复到原始位置和大小
```

### 6.4 Rust 依赖（Cargo.toml 预估）

```toml
[dependencies]
tauri = { version = "2", features = ["tray-icon"] }
tauri-plugin-shell = "2"
tauri-plugin-notification = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
image = "0.25"                    # PNG 编码
windows = { version = "0.58", features = [
    "Win32_UI_Shell",             # SHGetFileInfo
    "Win32_UI_WindowsAndMessaging", # Icon/Cursor API
    "Win32_Graphics_Gdi",         # Bitmap 转换
] }
```

---

## 七、迁移步骤建议

1. **初始化 Tauri v2 项目**（`npm create tauri-app`），保留 React + Vite 前端配置
2. **复制前端代码**：将 `src/` 目录下所有组件和样式迁移到新项目
3. **实现 Rust 后端命令**：按优先级依次实现
   - 数据持久化（load/save）→ 前端状态能正常恢复
   - 文件图标自定义协议 → 解决核心痛点
   - 文件操作（is_directory、open_path）
   - 窗口管理（锁定、透明度）
   - 边缘吸附自动隐藏 → 最复杂，最后实现
4. **适配前端调用**：将 `window.electronAPI.xxx` 替换为 `invoke('xxx')`
5. **修复 CardContainer 状态提升**：将 cards 纳入 App.tsx 管理并持久化
6. **测试打包**：`npm run tauri build` 验证安装包大小和功能完整性
