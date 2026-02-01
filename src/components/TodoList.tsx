import React, { useState } from 'react';
import TodoItem from './TodoItem';
import TodoForm from './TodoForm';
import './TodoList.css';

interface Todo {
  id: string;
  title: string;
  time: string;
  description: string;
  completed: boolean;
}

interface TodoListProps {
  todos: Todo[];
  onAddTodo: (todo: Omit<Todo, 'id' | 'completed'>) => void;
  onToggleTodo: (id: string) => void;
  onDeleteTodo: (id: string) => void;
}

const TodoList: React.FC<TodoListProps> = ({
  todos,
  onAddTodo,
  onToggleTodo,
  onDeleteTodo,
}) => {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="todo-list">
      <div className="todo-list-header">
        <h2>待办事项</h2>
        <button
          className="add-todo-button"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? '−' : '+'}
        </button>
      </div>

      {showForm && (
        <TodoForm
          onSubmit={(todo) => {
            onAddTodo(todo);
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      <div className="todo-list-body">
        {todos.length === 0 ? (
          <div className="empty-state">
            暂无待办事项
          </div>
        ) : (
          todos.map(todo => (
            <TodoItem
              key={todo.id}
              todo={todo}
              onToggle={() => onToggleTodo(todo.id)}
              onDelete={() => onDeleteTodo(todo.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default TodoList;
