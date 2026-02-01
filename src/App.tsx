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
}

declare global {
  interface Window {
    electronAPI?: {
      toggleLock: () => Promise<boolean>;
      getLockState: () => Promise<boolean>;
      showNotification: (title: string, body: string) => Promise<void>;
      openPath: (filePath: string) => Promise<void>;
      setOpacity?: (opacity: number) => Promise<void>;
    };
  }
}

const App: React.FC = () => {
  const [isLocked, setIsLocked] = useState(false);
  const [containers, setContainers] = useState<CardContainer[]>([
    { id: '1', name: '文件区 1' },
  ]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [transparency, setTransparency] = useState(0);

  useEffect(() => {
    // Get initial lock state
    const getInitialState = async () => {
      if (window.electronAPI) {
        const locked = await window.electronAPI.getLockState();
        setIsLocked(locked);
      }
    };
    getInitialState();
  }, []);


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

  const handleAddTodo = (todo: Omit<Todo, 'id' | 'completed'>) => {
    const newTodo: Todo = {
      ...todo,
      id: Date.now().toString(),
      completed: false,
    };
    setTodos([...todos, newTodo]);
  };

  const handleToggleTodo = (id: string) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  const handleDeleteTodo = (id: string) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  const handleTransparencyChange = (value: number) => {
    setTransparency(value);
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
        <FileManager
          containers={containers}
          onAddContainer={handleAddContainer}
        />

        <TodoList
          todos={todos}
          onAddTodo={handleAddTodo}
          onToggleTodo={handleToggleTodo}
          onDeleteTodo={handleDeleteTodo}
        />
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
