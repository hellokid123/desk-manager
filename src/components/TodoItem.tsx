import React, { useState } from 'react';
import TodoForm from './TodoForm';
import './TodoItem.css';

interface Todo {
  id: string;
  title: string;
  time: string;
  description: string;
  completed: boolean;
  deleted: boolean;
}

interface TodoItemProps {
  todo: Todo;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: (todo: Todo) => void;
  onRestore?: () => void;
}

const TodoItem: React.FC<TodoItemProps> = ({ todo, onToggle, onDelete, onEdit, onRestore }) => {
  const [isEditing, setIsEditing] = useState(false);

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

  const handleEditSubmit = (editedTodo: Omit<Todo, 'id' | 'completed'>) => {
    onEdit({
      ...todo,
      title: editedTodo.title,
      time: editedTodo.time,
      description: editedTodo.description,
    });
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="todo-item editing">
        <TodoForm
          initialTodo={todo}
          onSubmit={handleEditSubmit}
          onCancel={() => setIsEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className={`todo-item ${todo.completed ? 'completed' : ''} ${isUrgent() ? 'urgent' : ''}`}>
      <div className="todo-item-header">
        {!todo.deleted && (
          <input
            type="checkbox"
            checked={todo.completed}
            onChange={onToggle}
            className="todo-checkbox"
          />
        )}
        <div className="todo-info" onClick={() => !todo.deleted && setIsEditing(true)} style={{ cursor: todo.deleted ? 'default' : 'pointer' }}>
          <h4 className="todo-title">{todo.title}</h4>
          {todo.time && (
            <span className="todo-time">{formatTime(todo.time)}</span>
          )}
        </div>
        {todo.deleted ? (
          <button className="todo-restore" onClick={onRestore} title="恢复">
            ↻
          </button>
        ) : (
          <button className="todo-delete" onClick={onDelete} title="删除">
            ×
          </button>
        )}
      </div>
      {todo.description && (
        <p className="todo-description">{todo.description}</p>
      )}
    </div>
  );
};

export default TodoItem;
