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
  order: number;
}

interface TodoListProps {
  todos: Todo[];
  onAddTodo: (todo: Omit<Todo, 'id' | 'completed' | 'deleted' | 'order'>) => void;
  onToggleTodo: (id: string) => void;
  onDeleteTodo: (id: string) => void;
  onEditTodo: (todo: Todo) => void;
  onRestoreTodo: (id: string) => void;
  onReorder: (todos: Todo[]) => void;
}

const TodoList: React.FC<TodoListProps> = ({
  todos,
  onAddTodo,
  onToggleTodo,
  onDeleteTodo,
  onEditTodo,
  onRestoreTodo,
  onReorder,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'completed' | 'deleted'>('pending');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [dragDirection, setDragDirection] = useState<'up' | 'down' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // 按状态分类并排序
  const pendingTodos = todos.filter(todo => !todo.completed && !todo.deleted).sort((a, b) => a.order - b.order);
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

  const handleDragStart = (e: React.DragEvent, todoId: string) => {
    setDraggedId(todoId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setOverIndex(index);

    if (draggedId) {
      const draggedIndex = pendingTodos.findIndex(t => t.id === draggedId);
      if (draggedIndex > index) {
        setDragDirection('up');
      } else if (draggedIndex < index) {
        setDragDirection('down');
      }
    }
  };

  const handleDragLeave = () => {
    setOverIndex(null);
    setDragDirection(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();

    if (!draggedId || activeTab !== 'pending') {
      setDraggedId(null);
      setOverIndex(null);
      setDragDirection(null);
      return;
    }

    const draggedIndex = pendingTodos.findIndex(t => t.id === draggedId);

    if (draggedIndex === -1 || draggedIndex === dropIndex) {
      setDraggedId(null);
      setOverIndex(null);
      setDragDirection(null);
      return;
    }

    // 创建新的待办列表副本
    const newTodos = [...todos];

    // 在新列表中找到待办和目标项目
    const draggedTodo = newTodos.find(t => t.id === draggedId);
    const allPendingInNewTodos = newTodos.filter(t => !t.completed && !t.deleted).sort((a, b) => a.order - b.order);
    const targetTodo = allPendingInNewTodos[dropIndex];

    if (draggedTodo && targetTodo && draggedTodo.id !== targetTodo.id) {
      // 交换 order 值
      const tempOrder = draggedTodo.order;
      draggedTodo.order = targetTodo.order;
      targetTodo.order = tempOrder;

      onReorder(newTodos);
    }

    setDraggedId(null);
    setOverIndex(null);
    setDragDirection(null);
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
          currentTodos.map((todo, index) => {
            const isOver = activeTab === 'pending' && overIndex === index;
            const isDragging = draggedId === todo.id;

            return (
              <div
                key={todo.id}
                draggable={activeTab === 'pending'}
                onDragStart={(e) => handleDragStart(e, todo.id)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                className={`todo-item-wrapper ${isDragging ? 'dragging' : ''} ${
                  isOver ? (dragDirection === 'up' ? 'drag-over-top' : 'drag-over-bottom') : ''
                }`}
              >
                <TodoItem
                  todo={todo}
                  onToggle={() => onToggleTodo(todo.id)}
                  onDelete={() => onDeleteTodo(todo.id)}
                  onEdit={onEditTodo}
                  onRestore={() => onRestoreTodo(todo.id)}
                  isEditing={editingId === todo.id}
                  onStartEditing={() => setEditingId(todo.id)}
                  onFinishEditing={() => setEditingId(null)}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TodoList;
