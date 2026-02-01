import React from 'react';
import './TodoItem.css';

interface Todo {
  id: string;
  title: string;
  time: string;
  description: string;
  completed: boolean;
}

interface TodoItemProps {
  todo: Todo;
  onToggle: () => void;
  onDelete: () => void;
}

const TodoItem: React.FC<TodoItemProps> = ({ todo, onToggle, onDelete }) => {
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

  return (
    <div className={`todo-item ${todo.completed ? 'completed' : ''} ${isUrgent() ? 'urgent' : ''}`}>
      <div className="todo-item-header">
        <input
          type="checkbox"
          checked={todo.completed}
          onChange={onToggle}
          className="todo-checkbox"
        />
        <div className="todo-info">
          <h4 className="todo-title">{todo.title}</h4>
          {todo.time && (
            <span className="todo-time">{formatTime(todo.time)}</span>
          )}
        </div>
        <button className="todo-delete" onClick={onDelete}>
          ×
        </button>
      </div>
      {todo.description && (
        <p className="todo-description">{todo.description}</p>
      )}
    </div>
  );
};

export default TodoItem;
