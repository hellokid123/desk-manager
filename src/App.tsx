import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import TopBar from './components/TopBar';
import FileManager from './components/FileManager';
import TodoList from './components/TodoList';
import SettingsPanel from './components/SettingsPanel';
import ResizeFrame from './components/ResizeFrame';
import './App.css';

interface FileCard {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
}

interface CardContainer {
  id: string;
  name: string;
  cards: FileCard[];
}

interface Todo {
  id: string;
  title: string;
  time: string;
  description: string;
  completed: boolean;
  deleted: boolean;
  order: number;
}

const App: React.FC = () => {
  const [isLocked, setIsLocked] = useState(false);
  const [containers, setContainers] = useState<CardContainer[]>([
    { id: '1', name: '文件区 1', cards: [] },
  ]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [transparency, setTransparency] = useState(0);
  const [fileManagerHeight, setFileManagerHeight] = useState(50);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // 用 ref 保持最新的 containers 状态，避免 Tauri 事件闭包中拿到旧值
  const containersRef = useRef(containers);
  useEffect(() => {
    containersRef.current = containers;
  }, [containers]);

  // 初始化：加载保存的数据
  useEffect(() => {
    const loadInitialState = async () => {
      try {
        const savedData = await invoke<{
          transparency: number;
          isLocked: boolean;
          containers: CardContainer[];
          todos: Todo[];
          fileManagerHeight: number;
        }>('load_app_data');

        setIsLocked(savedData.isLocked);
        setContainers(
          savedData.containers.map((c) => ({
            ...c,
            cards: c.cards || [],
          }))
        );
        const todosWithOrder = savedData.todos.map((todo: Todo, index: number) => ({
          ...todo,
          order: todo.order ?? index,
        }));
        setTodos(todosWithOrder);
        setTransparency(savedData.transparency);
        setFileManagerHeight(savedData.fileManagerHeight);
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to load app data:', error);
        setIsInitialized(true);
      }
    };
    loadInitialState();
  }, []);

  // 监听 Tauri 拖拽事件（窗口级），获取真实文件路径
  useEffect(() => {
    const webview = getCurrentWebviewWindow();
    const unlisten = webview.onDragDropEvent(async (event) => {
      if (event.payload.type === 'enter' || event.payload.type === 'over') {
        setIsDragOver(true);
      } else if (event.payload.type === 'leave') {
        setIsDragOver(false);
      } else if (event.payload.type === 'drop') {
        setIsDragOver(false);
        const paths: string[] = event.payload.paths;
        if (paths.length === 0) return;

        // 并行检查每个路径是否为文件夹
        const newCards = await Promise.all(
          paths.map(async (filePath) => {
            let isFolder = false;
            try {
              isFolder = await invoke<boolean>('is_directory', { filePath });
            } catch {
              isFolder = false;
            }

            // 从路径中提取文件名
            const name = filePath.split('\\').pop() || filePath.split('/').pop() || filePath;

            return {
              id: Date.now().toString() + Math.random().toString(),
              name,
              type: (isFolder ? 'folder' : 'file') as 'file' | 'folder',
              path: filePath,
            };
          })
        );

        // 添加到第一个容器
        const currentContainers = containersRef.current;
        if (currentContainers.length > 0) {
          const firstContainer = currentContainers[0];
          const updatedContainers = currentContainers.map((c) =>
            c.id === firstContainer.id
              ? { ...c, cards: [...c.cards, ...newCards] }
              : c
          );
          setContainers(updatedContainers);
        }
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // 监听状态变化并保存数据
  useEffect(() => {
    if (!isInitialized) return;

    const saveData = async () => {
      await invoke('save_app_data', {
        data: {
          transparency,
          isLocked,
          containers,
          todos,
          fileManagerHeight,
          windowSize: { width: 0, height: 0 },
        },
      });
    };

    saveData();
  }, [transparency, isLocked, containers, todos, fileManagerHeight, isInitialized]);

  useEffect(() => {
    const checkNotifications = setInterval(() => {
      const now = new Date();
      todos.forEach((todo) => {
        if (!todo.completed && todo.time) {
          const todoTime = new Date(todo.time);
          const timeDiff = todoTime.getTime() - now.getTime();
          if (timeDiff > 0 && timeDiff <= 5 * 60 * 1000) {
            invoke('show_notification', {
              title: `待办提醒: ${todo.title}`,
              body: todo.description,
            });
          }
        }
      });
    }, 60000);

    return () => clearInterval(checkNotifications);
  }, [todos]);

  const handleToggleLock = async () => {
    const newState = await invoke<boolean>('toggle_lock');
    setIsLocked(newState);
  };

  const handleUpdateContainerCards = (containerId: string, cards: FileCard[]) => {
    setContainers(
      containers.map((c) => (c.id === containerId ? { ...c, cards } : c))
    );
  };

  const handleAddTodo = (todo: Omit<Todo, 'id' | 'completed' | 'deleted' | 'order'>) => {
    const newTodo: Todo = {
      ...todo,
      id: Date.now().toString(),
      completed: false,
      deleted: false,
      order: Math.max(...todos.map((t) => t.order), 0) + 1,
    };
    setTodos([...todos, newTodo]);
  };

  const handleReorderTodos = (reorderedTodos: Todo[]) => {
    setTodos(reorderedTodos);
  };

  const handleToggleTodo = (id: string) => {
    setTodos(todos.map((todo) => (todo.id === id ? { ...todo, completed: !todo.completed } : todo)));
  };

  const handleDeleteTodo = (id: string) => {
    setTodos(todos.map((todo) => (todo.id === id ? { ...todo, deleted: true } : todo)));
  };

  const handleEditTodo = (updatedTodo: Todo) => {
    setTodos(todos.map((todo) => (todo.id === updatedTodo.id ? updatedTodo : todo)));
  };

  const handleRestoreTodo = (id: string) => {
    setTodos(todos.map((todo) => (todo.id === id ? { ...todo, deleted: false } : todo)));
  };

  const handleTransparencyChange = (value: number) => {
    setTransparency(value);
  };

  const handleMouseDownDivider = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = fileManagerHeight;
    const mainContent = document.querySelector('.main-content') as HTMLElement;
    if (!mainContent) return;
    const totalHeight = mainContent.clientHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const newHeight = startHeight + (deltaY / totalHeight) * 100;
      const clampedHeight = Math.max(20, Math.min(80, newHeight));
      setFileManagerHeight(clampedHeight);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const bgOpacity = (100 - transparency) / 100;

  return (
    <div
      className={`app ${isLocked ? 'locked' : ''} ${isDragOver ? 'drag-over' : ''}`}
      style={{ backgroundColor: `rgba(255, 255, 255, ${bgOpacity})` }}
    >
      <ResizeFrame isLocked={isLocked} />

      <TopBar
        isLocked={isLocked}
        onToggleLock={handleToggleLock}
        onOpenSettings={() => setShowSettings(true)}
      />

      <div className="main-content">
        <div style={{ flex: fileManagerHeight / 100 }}>
          <FileManager
            containers={containers}
            onUpdateContainerCards={handleUpdateContainerCards}
          />
        </div>

        <div className="divider" onMouseDown={handleMouseDownDivider} />

        <div style={{ flex: (100 - fileManagerHeight) / 100 }}>
          <TodoList
            todos={todos}
            onAddTodo={handleAddTodo}
            onToggleTodo={handleToggleTodo}
            onDeleteTodo={handleDeleteTodo}
            onEditTodo={handleEditTodo}
            onRestoreTodo={handleRestoreTodo}
            onReorder={handleReorderTodos}
          />
        </div>
      </div>

      {showSettings && (
        <SettingsPanel
          transparency={transparency}
          onTransparencyChange={handleTransparencyChange}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
};

export default App;
