// C:\websmith\app\projects\components\ProjectCard.tsx
// Project Card - Displays individual project with actions
// Features: Status badges, priority indicators, edit/delete buttons

'use client';

import { Project } from '../services/projectService';
import { CheckCircle, Folder, Calendar, DollarSign, Edit2, MessageSquareQuote, Trash2 } from 'lucide-react';

interface ProjectCardProps {
  project: Project;
  onEdit: (project: Project) => void;
  onDelete: (id: string) => void;
  onTogglePublish?: (project: Project) => void;
  onMarkCompleted?: (project: Project) => void;
  onViewFeedback?: (project: Project) => void;
}

const statusColors = {
  'pending': { bg: 'rgba(255, 149, 0, 0.1)', color: '#FF9500', text: 'Pending' },
  'in-progress': { bg: 'rgba(0, 122, 255, 0.1)', color: '#007AFF', text: 'In Progress' },
  'completed': { bg: 'rgba(52, 199, 89, 0.1)', color: '#34C759', text: 'Completed' },
  'on-hold': { bg: 'rgba(255, 59, 48, 0.1)', color: '#FF3B30', text: 'On Hold' },
};

const priorityColors = {
  'low': { bg: 'rgba(52, 199, 89, 0.1)', color: '#34C759', text: 'Low' },
  'medium': { bg: 'rgba(255, 149, 0, 0.1)', color: '#FF9500', text: 'Medium' },
  'high': { bg: 'rgba(255, 59, 48, 0.1)', color: '#FF3B30', text: 'High' },
};

export default function ProjectCard({ project, onEdit, onDelete, onTogglePublish, onMarkCompleted, onViewFeedback }: ProjectCardProps) {
  const status = statusColors[project.status] || { bg: 'var(--bg-secondary)', color: 'var(--text-secondary)', text: project.status };
  const priority = priorityColors[project.priority] || { bg: 'var(--bg-secondary)', color: 'var(--text-secondary)', text: project.priority };
  const latestUpdate = project.statusUpdates?.[project.statusUpdates.length - 1];

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div style={styles.card} className="project-card">
      <div style={styles.cardHeader}>
        <div style={styles.iconContainer}>
          <Folder size={24} color="#007AFF" />
        </div>
        <div style={styles.badgeContainer}>
          <span style={{ ...styles.badge, backgroundColor: status.bg, color: status.color }}>
            {status.text}
          </span>
          <span style={{ ...styles.badge, backgroundColor: priority.bg, color: priority.color }}>
            {priority.text}
          </span>
        </div>
      </div>

      <h3 style={styles.projectName}>{project.name}</h3>
      <p style={styles.projectDescription}>{project.description}</p>

      <div style={styles.assignmentBlock}>
        <p style={styles.assignmentText}><strong>Client:</strong> {project.client}</p>
        <p style={styles.assignmentText}><strong>Developer:</strong> {project.assignedDeveloperName || "Unassigned"}</p>
      </div>

      <div style={styles.projectDetails}>
        <div style={styles.detailItem}>
          <Calendar size={14} color="var(--text-secondary)" />
          <span style={styles.detailText}>
            {formatDate(project.startDate)} {project.endDate && `- ${formatDate(project.endDate)}`}
          </span>
        </div>
        {project.expectedCompletionDate && (
          <div style={styles.detailItem}>
            <Calendar size={14} color="#007AFF" />
            <span style={{ ...styles.detailText, color: '#007AFF', fontWeight: 600 }}>
              Due: {formatDate(project.expectedCompletionDate)}
            </span>
          </div>
        )}
        {project.budget && (
          <div style={styles.detailItem}>
            <DollarSign size={14} color="var(--text-secondary)" />
            <span style={styles.detailText}>${project.budget.toLocaleString()}</span>
          </div>
        )}
      </div>

      <div style={styles.updateBox}>
        <p style={styles.updateLabel}>Latest Update</p>
        <p style={styles.updateText}>{latestUpdate?.note || "No status updates yet"}</p>
      </div>

      <div style={styles.cardActions}>
        {onTogglePublish && (
          <button 
            onClick={() => onTogglePublish(project)} 
            style={{
              ...styles.publishBtn,
              backgroundColor: project.published ? '#FEF3C7' : '#E8FFF3',
              color: project.published ? '#D97706' : '#16A34A',
            }}
            className="card-action-btn"
          >
            <span>{project.published ? 'Unpublish' : 'Publish'}</span>
          </button>
        )}
        {onMarkCompleted && project.status !== 'completed' && (
          <button onClick={() => onMarkCompleted(project)} style={styles.completeBtn} className="card-action-btn">
            <CheckCircle size={16} />
            <span>Mark as Done</span>
          </button>
        )}
        {onViewFeedback && (
          <button onClick={() => onViewFeedback(project)} style={styles.feedbackBtn} className="card-action-btn">
            <MessageSquareQuote size={16} />
            <span>Feedback</span>
          </button>
        )}
        <button onClick={() => onEdit(project)} style={styles.editBtn} className="card-action-btn">
          <Edit2 size={16} />
          <span>Edit</span>
        </button>
        <button onClick={() => onDelete(project._id!)} style={styles.deleteBtn} className="card-action-btn">
          <Trash2 size={16} />
          <span>Delete</span>
        </button>
      </div>

      <style>{`
        .project-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .project-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0,0,0,0.12);
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
  projectName: {
    fontSize: '18px',
    fontWeight: 700,
    marginBottom: '8px',
    color: 'var(--text-primary)',
    letterSpacing: '-0.3px',
  },
  projectDescription: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    marginBottom: '20px',
    lineHeight: 1.6,
  },
  assignmentBlock: {
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: '14px',
    padding: '14px',
    marginBottom: '20px',
    border: '1px solid var(--border-color)',
  },
  assignmentText: {
    fontSize: '13px',
    color: 'var(--text-primary)',
    margin: 0,
    marginBottom: '4px',
  },
  projectDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '24px',
    paddingBottom: '20px',
    borderBottom: '1.5px solid var(--border-color)',
  },
  updateBox: {
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: '14px',
    padding: '14px',
    marginBottom: '24px',
    border: '1px solid var(--border-color)',
  },
  updateLabel: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    fontWeight: 600,
    margin: 0,
    marginBottom: '8px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  updateText: {
    fontSize: '13px',
    color: 'var(--text-primary)',
    margin: 0,
    lineHeight: 1.5,
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
    flexWrap: 'wrap',
    marginTop: 'auto',
  },
  publishBtn: {
    flex: 1,
    padding: '8px',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  completeBtn: {
    flex: 1,
    padding: '10px',
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    border: '1px solid rgba(52, 199, 89, 0.2)',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: 700,
    color: '#16A34A',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontFamily: 'inherit',
  },
  feedbackBtn: {
    flex: 1,
    padding: '10px',
    backgroundColor: 'rgba(0, 122, 255, 0.08)',
    border: '1px solid rgba(0, 122, 255, 0.16)',
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
