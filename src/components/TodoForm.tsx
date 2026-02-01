import React, { useState } from 'react';
import './TodoForm.css';

interface Todo {
  title: string;
  time: string;
  description: string;
}

interface TodoFormProps {
  onSubmit: (todo: Todo) => void;
  onCancel: () => void;
}

const TodoForm: React.FC<TodoFormProps> = ({ onSubmit, onCancel }) => {
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onSubmit({
        title: title.trim(),
        time,
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
      <input
        type="datetime-local"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        className="todo-form-input"
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
          添加
        </button>
        <button type="button" className="todo-form-cancel" onClick={onCancel}>
          取消
        </button>
      </div>
    </form>
  );
};

export default TodoForm;
