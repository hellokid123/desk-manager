import React, { useState, useEffect } from 'react';
import TodoForm from './TodoForm';
import './TodoItem.css';

interface Todo {
  id: string;
  title: string;
  time: string;
  description: string;
  completed: boolean;
  deleted: boolean;
  order: number;
}

interface TodoItemProps {
  todo: Todo;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: (todo: Todo) => void;
  onRestore?: () => void;
  isEditing: boolean;
  onStartEditing: () => void;
  onFinishEditing: () => void;
}

const TodoItem: React.FC<TodoItemProps> = ({ todo, onToggle, onDelete, onEdit, onRestore, isEditing, onStartEditing, onFinishEditing }) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const formatTime = (time: string) => {
    const date = new Date(time);
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isUrgent = () => {
    const now = new Date();
    const todoTime = new Date(todo.time);
    const timeDiff = todoTime.getTime() - now.getTime();
    return timeDiff > 0 && timeDiff <= 60 * 60 * 1000; // Within 1 hour
  };

  const handleEditSubmit = (editedTodo: Omit<Todo, 'id' | 'completed' | 'order' | 'deleted'>) => {
    onEdit({
      ...todo,
      title: editedTodo.title,
      time: editedTodo.time,
      description: editedTodo.description,
    });
    onFinishEditing();
  };

  // 点击任何地方关闭菜单
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null);
    };

    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => {
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [contextMenu]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleDeleteFromMenu = () => {
    onDelete();
    setContextMenu(null);
  };

  const handleRestoreFromMenu = () => {
    onRestore?.();
    setContextMenu(null);
  };

  // 点击其他地方关闭菜单
  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  if (isEditing) {
    return (
      <div className="todo-item editing">
        <TodoForm
          initialTodo={todo}
          onSubmit={handleEditSubmit}
          onCancel={onFinishEditing}
        />
      </div>
    );
  }

  return (
    <div
      className={`todo-item ${todo.completed ? 'completed' : ''} ${isUrgent() ? 'urgent' : ''}`}
      onContextMenu={handleContextMenu}
    >
      <div className="todo-item-header">
        {!todo.deleted && (
          <input
            type="checkbox"
            checked={todo.completed}
            onChange={onToggle}
            className="todo-checkbox"
          />
        )}
        <div className="todo-info" onClick={() => !todo.deleted && onStartEditing()} style={{ cursor: todo.deleted ? 'default' : 'pointer' }}>
          <h4 className="todo-title">{todo.title}</h4>
          {todo.time && (
            <span className="todo-time">{formatTime(todo.time)}</span>
          )}
        </div>
      </div>
      {todo.description && (
        <p className="todo-description">{todo.description}</p>
      )}

      {/* 右键菜单 */}
      {contextMenu && (
        <div
          className="todo-context-menu"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          onClick={handleMenuClick}
        >
          {todo.deleted ? (
            <button className="context-menu-item restore" onClick={handleRestoreFromMenu}>
              恢复
            </button>
          ) : (
            <button className="context-menu-item delete" onClick={handleDeleteFromMenu}>
              删除
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default TodoItem;
