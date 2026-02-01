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
  deleted: boolean;
}

interface TodoListProps {
  todos: Todo[];
  onAddTodo: (todo: Omit<Todo, 'id' | 'completed' | 'deleted'>) => void;
  onToggleTodo: (id: string) => void;
  onDeleteTodo: (id: string) => void;
  onEditTodo: (todo: Todo) => void;
  onRestoreTodo: (id: string) => void;
}

const TodoList: React.FC<TodoListProps> = ({
  todos,
  onAddTodo,
  onToggleTodo,
  onDeleteTodo,
  onEditTodo,
  onRestoreTodo,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'completed' | 'deleted'>('pending');

  // 按状态分类
  const pendingTodos = todos.filter(todo => !todo.completed && !todo.deleted);
  const completedTodos = todos.filter(todo => todo.completed && !todo.deleted);
  const deletedTodos = todos.filter(todo => todo.deleted);

  const getCurrentTodos = () => {
    switch (activeTab) {
      case 'pending':
        return pendingTodos;
      case 'completed':
        return completedTodos;
      case 'deleted':
        return deletedTodos;
      default:
        return [];
    }
  };

  const currentTodos = getCurrentTodos();

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

      <div className="todo-tabs">
        <button
          className={`todo-tab ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          待办 ({pendingTodos.length})
        </button>
        <button
          className={`todo-tab ${activeTab === 'completed' ? 'active' : ''}`}
          onClick={() => setActiveTab('completed')}
        >
          已完成 ({completedTodos.length})
        </button>
        <button
          className={`todo-tab ${activeTab === 'deleted' ? 'active' : ''}`}
          onClick={() => setActiveTab('deleted')}
        >
          已删除 ({deletedTodos.length})
        </button>
      </div>

      <div className="todo-list-body">
        {currentTodos.length === 0 ? (
          <div className="empty-state">
            {activeTab === 'pending' && '暂无待办事项'}
            {activeTab === 'completed' && '暂无已完成事项'}
            {activeTab === 'deleted' && '暂无已删除事项'}
          </div>
        ) : (
          currentTodos.map(todo => (
            <TodoItem
              key={todo.id}
              todo={todo}
              onToggle={() => onToggleTodo(todo.id)}
              onDelete={() => onDeleteTodo(todo.id)}
              onEdit={onEditTodo}
              onRestore={() => onRestoreTodo(todo.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default TodoList;
