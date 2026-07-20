// C:\websmith\app\tasks\components\TaskCard.tsx
// Task Card - Displays individual task with actions
// Features: Status badges, priority indicators, edit/delete buttons

'use client';

import { Task } from '../services/taskService';
import { CheckSquare, Calendar, Edit2, Trash2, User } from 'lucide-react';

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
}

const statusColors: Record<string, { bg: string; color: string; text: string }> = {
  'pending': { bg: 'rgba(255, 149, 0, 0.1)', color: '#FF9500', text: 'Pending' },
  'in-progress': { bg: 'rgba(0, 122, 255, 0.1)', color: '#007AFF', text: 'In Progress' },
  'completed': { bg: 'rgba(52, 199, 89, 0.1)', color: '#34C759', text: 'Completed' },
  'review': { bg: 'rgba(175, 82, 222, 0.1)', color: '#AF52DE', text: 'Review' },
};

const priorityColors: Record<string, { bg: string; color: string; text: string }> = {
  'low': { bg: 'rgba(52, 199, 89, 0.1)', color: '#34C759', text: 'Low' },
  'medium': { bg: 'rgba(255, 149, 0, 0.1)', color: '#FF9500', text: 'Medium' },
  'high': { bg: 'rgba(255, 59, 48, 0.1)', color: '#FF3B30', text: 'High' },
};

export default function TaskCard({ task, onEdit, onDelete }: TaskCardProps) {
  const status = statusColors[task.status] || { bg: 'var(--bg-secondary)', color: 'var(--text-secondary)', text: task.status };
  const priority = priorityColors[task.priority] || { bg: 'var(--bg-secondary)', color: 'var(--text-secondary)', text: task.priority };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No due date';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div style={styles.card} className="task-card">
      <div style={styles.cardHeader}>
        <div style={styles.iconContainer}>
          <CheckSquare size={24} color="#007AFF" />
        </div>
        <div style={styles.badgeContainer}>
          <span style={{ ...styles.badge, backgroundColor: priority.bg, color: priority.color }}>
            {priority.text}
          </span>
          <span style={{ ...styles.badge, backgroundColor: status.bg, color: status.color }}>
            {status.text}
          </span>
        </div>
      </div>

      <h3 style={styles.taskTitle}>{task.title}</h3>
      <p style={styles.taskDescription}>{task.description || 'No description provided for this task.'}</p>

      <div style={styles.taskDetails}>
        {task.dueDate && (
          <div style={styles.detailItem}>
            <Calendar size={14} color="var(--text-secondary)" />
            <span style={styles.detailText}>Due {formatDate(task.dueDate)}</span>
          </div>
        )}
        {task.assignee && (
          <div style={styles.detailItem}>
            <User size={14} color="var(--text-secondary)" />
            <span style={styles.detailText}>{task.assignee}</span>
          </div>
        )}
      </div>

      <div style={styles.cardActions}>
        <button onClick={() => onEdit(task)} style={styles.editBtn} className="card-action-btn">
          <Edit2 size={16} />
          <span>Edit</span>
        </button>
        <button onClick={() => onDelete(task._id!)} style={styles.deleteBtn} className="card-action-btn">
          <Trash2 size={16} />
          <span>Delete</span>
        </button>
      </div>

      <style>{`
        .task-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .task-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 32px rgba(0,0,0,0.12);
          border-color: #007AFF55 !important;
        }
        .card-action-btn {
          transition: all 0.2s ease;
        }
        .card-action-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.05);
        }
      `}</style>
    </div>
  );
}

const styles: any = {
  card: {
    backgroundColor: 'var(--bg-primary)',
    borderRadius: '20px',
    padding: '24px',
    border: '1.5px solid var(--border-color)',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '20px',
  },
  iconContainer: {
    width: '48px',
    height: '48px',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid var(--border-color)',
  },
  badgeContainer: {
    display: 'flex',
    gap: '8px',
  },
  badge: {
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
  },
  taskTitle: {
    fontSize: '18px',
    fontWeight: 700,
    marginBottom: '8px',
    color: 'var(--text-primary)',
    letterSpacing: '-0.3px',
  },
  taskDescription: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    marginBottom: '20px',
    lineHeight: 1.6,
  },
  taskDetails: {
    display: 'flex',
    gap: '16px',
    marginBottom: '24px',
    paddingBottom: '20px',
    borderBottom: '1.5px solid var(--border-color)',
  },
  detailItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  detailText: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
  },
  cardActions: {
    display: 'flex',
    gap: '12px',
    marginTop: 'auto',
  },
  editBtn: {
    flex: 1,
    padding: '10px',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: 700,
    color: '#007AFF',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontFamily: 'inherit',
  },
  deleteBtn: {
    flex: 1,
    padding: '10px',
    backgroundColor: 'rgba(255, 59, 48, 0.05)',
    border: '1px solid rgba(255, 59, 48, 0.1)',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: 700,
    color: '#FF3B30',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontFamily: 'inherit',
  },
};