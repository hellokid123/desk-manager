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
  initialTodo?: Todo;
}

const TodoForm: React.FC<TodoFormProps> = ({ onSubmit, onCancel, initialTodo }) => {
  // 获取当前日期和时间
  const getDefaultDateTime = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${date}T${hours}:${minutes}`;
  };

  const getDefaultTime = () => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const getTodayDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${date}`;
  };

  const [title, setTitle] = useState(initialTodo?.title || '');
  const [time, setTime] = useState(() => {
    if (initialTodo?.time) {
      // 从datetime-local格式提取时间部分 (HH:mm)
      return initialTodo.time.split('T')[1]?.slice(0, 5) || getDefaultTime();
    }
    return getDefaultTime();
  });
  const [description, setDescription] = useState(initialTodo?.description || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      // 如果是编辑，使用选择的时间；如果是新建，使用当前时间
      const dateTime = initialTodo ? `${getTodayDateString()}T${time}` : getDefaultDateTime();

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
      {initialTodo && (
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="todo-form-input"
        />
      )}
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
