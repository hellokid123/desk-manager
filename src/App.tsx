import React, { useState, useEffect } from 'react';
import TopBar from './components/TopBar';
import FileManager from './components/FileManager';
import TodoList from './components/TodoList';
import SettingsPanel from './components/SettingsPanel';
import ResizeFrame from './components/ResizeFrame';
import './App.css';

interface CardContainer {
  id: string;
  name: string;
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
    { id: '1', name: '文件区 1' },
  ]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [transparency, setTransparency] = useState(0);
  const [fileManagerHeight, setFileManagerHeight] = useState(50); // 百分比
  const [isInitialized, setIsInitialized] = useState(false);

  // 初始化：加载保存的数据
  useEffect(() => {
    const loadInitialState = async () => {
      try {
        if (window.electronAPI) {
          const savedData = await window.electronAPI.loadAppData();
          setIsLocked(savedData.isLocked);
          setContainers(savedData.containers);
          // 确保 todos 有 order 字段
          const todosWithOrder = savedData.todos.map((todo: any, index: number) => ({
            ...todo,
            order: todo.order ?? index,
          }));
          setTodos(todosWithOrder);
          setTransparency(savedData.transparency);
          setFileManagerHeight(savedData.fileManagerHeight);
          setIsInitialized(true);
        }
      } catch (error) {
        console.error('Failed to load app data:', error);
        setIsInitialized(true);
      }
    };
    loadInitialState();
  }, []);

  // 监听状态变化并保存数据（不在初始化时保存）
  useEffect(() => {
    if (!isInitialized) return;

    const saveData = async () => {
      if (window.electronAPI) {
        await window.electronAPI.saveAppData({
          transparency,
          isLocked,
          containers,
          todos,
          fileManagerHeight,
          windowSize: { width: 0, height: 0 },
          windowPosition: { x: 0, y: 0 },
        });
      }
    };

    saveData();
  }, [transparency, isLocked, containers, todos, fileManagerHeight, isInitialized]);

  useEffect(() => {
    // Check for todo notifications
    const checkNotifications = setInterval(() => {
      const now = new Date();
      todos.forEach((todo) => {
        if (!todo.completed && todo.time) {
          const todoTime = new Date(todo.time);
          const timeDiff = todoTime.getTime() - now.getTime();
          // Notify if within 5 minutes
          if (timeDiff > 0 && timeDiff <= 5 * 60 * 1000) {
            if (window.electronAPI) {
              window.electronAPI.showNotification(
                `待办提醒: ${todo.title}`,
                todo.description
              );
            }
          }
        }
      });
    }, 60000); // Check every minute

    return () => clearInterval(checkNotifications);
  }, [todos]);

  const handleToggleLock = async () => {
    if (window.electronAPI) {
      const newState = await window.electronAPI.toggleLock();
      setIsLocked(newState);
    }
  };

  const handleAddContainer = () => {
    const newId = Date.now().toString();
    setContainers([...containers, { id: newId, name: `文件区 ${containers.length + 1}` }]);
  };

  const handleAddTodo = (todo: Omit<Todo, 'id' | 'completed' | 'deleted' | 'order'>) => {
    const newTodo: Todo = {
      ...todo,
      id: Date.now().toString(),
      completed: false,
      deleted: false,
      order: Math.max(...todos.map(t => t.order), 0) + 1,
    };
    setTodos([...todos, newTodo]);
  };

  const handleReorderTodos = (reorderedTodos: Todo[]) => {
    setTodos(reorderedTodos);
  };

  const handleToggleTodo = (id: string) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  const handleDeleteTodo = (id: string) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, deleted: true } : todo
    ));
  };

  const handleEditTodo = (updatedTodo: Todo) => {
    setTodos(todos.map(todo =>
      todo.id === updatedTodo.id ? updatedTodo : todo
    ));
  };

  const handleRestoreTodo = (id: string) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, deleted: false } : todo
    ));
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
      // 限制高度范围：最小 20%，最大 80%
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
      className={`app ${isLocked ? 'locked' : ''}`}
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
            onAddContainer={handleAddContainer}
          />
        </div>

        <div
          className="divider"
          onMouseDown={handleMouseDownDivider}
        />

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
