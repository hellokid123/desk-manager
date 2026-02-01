import React, { useState } from 'react';
import './TodoForm.css';

interface Todo {
  title: string;
  time: string;
  description: string;
  deleted?: boolean;
}

interface TodoFormProps {
  onSubmit: (todo: Todo) => void;
  onCancel: () => void;
  initialTodo?: Todo;
}

const TodoForm: React.FC<TodoFormProps> = ({ onSubmit, onCancel, initialTodo }) => {
  const [title, setTitle] = useState(initialTodo?.title || '');
  const [description, setDescription] = useState(initialTodo?.description || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      const dateTime = initialTodo
        ? initialTodo.time
        : new Date().toISOString().slice(0, 16);

      onSubmit({
        title: title.trim(),
        time: dateTime,
        description: description.trim(),
      });
    }
  };

  return (
    <form className="todo-form" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="任务主题"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="todo-form-input"
        required
      />
      <textarea
        placeholder="任务描述（可选）"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="todo-form-textarea"
        rows={2}
      />
      <div className="todo-form-buttons">
        <button type="submit" className="todo-form-submit">
          {initialTodo ? '保存' : '添加'}
        </button>
        <button type="button" className="todo-form-cancel" onClick={onCancel}>
          取消
        </button>
      </div>
    </form>
  );
};

export default TodoForm;
