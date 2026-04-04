// C:\websmith\app\tasks\page.tsx
// Tasks Page - Main tasks management page
// Features: List tasks, add/edit/delete, search, filter by status

'use client';

import { useState } from 'react';
import { Plus, Search, CheckSquare } from 'lucide-react';
import { useTasks } from './hooks/useTasks';
import TaskCard from './components/TaskCard';
import TaskModal from './components/TaskModal';
import { Task } from './services/taskService';

export default function TasksPage() {
  const { tasks, loading, error, addTask, editTask, removeTask, fetchTasks } = useTasks();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const handleAddTask = () => {
    setEditingTask(null);
    setIsModalOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const handleSaveTask = async (taskData: any) => {
    if (editingTask) {
      await editTask(editingTask._id!, taskData);
    } else {
      await addTask(taskData);
    }
    setIsModalOpen(false);
    setEditingTask(null);
    fetchTasks();
  };

  const handleDeleteTask = async (id: string) => {
    if (confirm('Are you sure you want to delete this task?')) {
      await removeTask(id);
    }
  };

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (task.assignee && task.assignee.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = {
    all: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    'in-progress': tasks.filter(t => t.status === 'in-progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Tasks</h1>
          <p style={styles.subtitle}>Manage all your project tasks</p>
        </div>
        <button onClick={handleAddTask} style={styles.addBtn} className="add-btn">
          <Plus size={18} />
          <span>New Task</span>
        </button>
      </div>

      {/* Search and Filter */}
      <div style={styles.searchSection}>
        <div style={styles.searchBox}>
          <Search size={18} color="#8E8E93" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
        </div>
        <div style={styles.filterTabs}>
          <button
            onClick={() => setStatusFilter('all')}
            style={{ ...styles.filterTab, ...(statusFilter === 'all' ? styles.filterTabActive : {}) }}
          >
            All ({statusCounts.all})
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            style={{ ...styles.filterTab, ...(statusFilter === 'pending' ? styles.filterTabActive : {}) }}
          >
            Pending ({statusCounts.pending})
          </button>
          <button
            onClick={() => setStatusFilter('in-progress')}
            style={{ ...styles.filterTab, ...(statusFilter === 'in-progress' ? styles.filterTabActive : {}) }}
          >
            In Progress ({statusCounts['in-progress']})
          </button>
          <button
            onClick={() => setStatusFilter('completed')}
            style={{ ...styles.filterTab, ...(statusFilter === 'completed' ? styles.filterTabActive : {}) }}
          >
            Completed ({statusCounts.completed})
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}></div>
          <p>Loading tasks...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div style={styles.errorContainer}>
          <p style={styles.errorText}>{error}</p>
          <button onClick={fetchTasks} style={styles.retryBtn}>Try Again</button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredTasks.length === 0 && (
        <div style={styles.emptyContainer}>
          <CheckSquare size={48} color="#C6C6C8" />
          <h3 style={styles.emptyTitle}>No tasks found</h3>
          <p style={styles.emptyText}>
            {searchTerm || statusFilter !== 'all' 
              ? 'Try adjusting your search or filter'
              : 'Create your first task to get started'}
          </p>
          {!searchTerm && statusFilter === 'all' && (
            <button onClick={handleAddTask} style={styles.emptyBtn}>Create Task</button>
          )}
        </div>
      )}

      {/* Tasks Grid */}
      {!loading && !error && filteredTasks.length > 0 && (
        <div style={styles.grid}>
          {filteredTasks.map((task) => (
            <TaskCard
              key={task._id}
              task={task}
              onEdit={handleEditTask}
              onDelete={handleDeleteTask}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      <TaskModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTask(null);
        }}
        onSave={handleSaveTask}
        task={editingTask}
      />

      <style>{`
        .add-btn {
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .add-btn:hover {
          background-color: #34C759 !important;
          transform: translateX(4px) translateY(-2px);
          box-shadow: 0 4px 12px rgba(52,199,89,0.3);
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const styles: any = {
  container: {
    padding: '8px 4px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '32px',
  },
  title: {
    fontSize: '34px',
    fontWeight: 600,
    letterSpacing: '-0.5px',
    color: '#1C1C1E',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '15px',
    color: '#8E8E93',
  },
  addBtn: {
    padding: '10px 20px',
    backgroundColor: '#007AFF',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontFamily: 'inherit',
  },
  searchSection: {
    marginBottom: '24px',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    backgroundColor: '#FFFFFF',
    border: '1px solid #E5E5EA',
    borderRadius: '12px',
    marginBottom: '16px',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: '15px',
    fontFamily: 'inherit',
    backgroundColor: 'transparent',
  },
  filterTabs: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  filterTab: {
    padding: '6px 16px',
    backgroundColor: '#F2F2F7',
    border: 'none',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: 500,
    color: '#8E8E93',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.2s ease',
  },
  filterTabActive: {
    backgroundColor: '#007AFF',
    color: '#FFFFFF',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
    gap: '20px',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px',
    gap: '16px',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #E5E5EA',
    borderTopColor: '#007AFF',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  errorContainer: {
    textAlign: 'center',
    padding: '60px',
    backgroundColor: '#FEF2F0',
    borderRadius: '16px',
  },
  errorText: {
    color: '#FF3B30',
    marginBottom: '16px',
  },
  retryBtn: {
    padding: '8px 20px',
    backgroundColor: '#007AFF',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  emptyContainer: {
    textAlign: 'center',
    padding: '60px',
  },
  emptyTitle: {
    fontSize: '20px',
    fontWeight: 600,
    color: '#1C1C1E',
    marginTop: '16px',
    marginBottom: '8px',
  },
  emptyText: {
    fontSize: '14px',
    color: '#8E8E93',
    marginBottom: '20px',
  },
  emptyBtn: {
    padding: '10px 24px',
    backgroundColor: '#007AFF',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};