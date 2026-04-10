// C:\websmith\app\projects\components\ProjectCard.tsx
// Project Card - Displays individual project with actions
// Features: Status badges, priority indicators, edit/delete buttons

'use client';

import { Project } from '../services/projectService';
import { Folder, Calendar, DollarSign, Edit2, Trash2, MoreVertical } from 'lucide-react';

interface ProjectCardProps {
  project: Project;
  onEdit: (project: Project) => void;
  onDelete: (id: string) => void;
  onTogglePublish?: (project: Project) => void;
}

const statusColors = {
  'pending': { bg: '#FFF4E5', color: '#FF9500', text: 'Pending' },
  'in-progress': { bg: '#E3F2FF', color: '#007AFF', text: 'In Progress' },
  'completed': { bg: '#E8F5E9', color: '#34C759', text: 'Completed' },
  'on-hold': { bg: '#FEF2F0', color: '#FF3B30', text: 'On Hold' },
};

const priorityColors = {
  'low': { bg: '#E8F5E9', color: '#34C759', text: 'Low' },
  'medium': { bg: '#FFF4E5', color: '#FF9500', text: 'Medium' },
  'high': { bg: '#FEF2F0', color: '#FF3B30', text: 'High' },
};

export default function ProjectCard({ project, onEdit, onDelete, onTogglePublish }: ProjectCardProps) {
  const status = statusColors[project.status];
  const priority = priorityColors[project.priority];
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
          <span style={{ ...styles.badge, ...styles.statusBadge, backgroundColor: status.bg, color: status.color }}>
            {status.text}
          </span>
          <span style={{ ...styles.badge, ...styles.priorityBadge, backgroundColor: priority.bg, color: priority.color }}>
            {priority.text}
          </span>
        </div>
      </div>

      <h3 style={styles.projectName}>{project.name}</h3>
      <p style={styles.projectDescription}>{project.description}</p>

      <div style={styles.assignmentBlock}>
        <p style={styles.assignmentText}>Client: {project.client}</p>
        <p style={styles.assignmentText}>Developer: {project.assignedDeveloperName || "Unassigned"}</p>
      </div>

      <div style={styles.projectDetails}>
        <div style={styles.detailItem}>
          <Calendar size={14} color="#8E8E93" />
          <span style={styles.detailText}>
            {formatDate(project.startDate)} {project.endDate && `- ${formatDate(project.endDate)}`}
          </span>
        </div>
        {project.expectedCompletionDate && (
          <div style={styles.detailItem}>
            <Calendar size={14} color="#007AFF" />
            <span style={{ ...styles.detailText, color: '#007AFF', fontWeight: 500 }}>
              Expected: {formatDate(project.expectedCompletionDate)}
            </span>
          </div>
        )}
        {project.budget && (
          <div style={styles.detailItem}>
            <DollarSign size={14} color="#8E8E93" />
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
          <button onClick={() => onTogglePublish(project)} style={styles.publishBtn} className="card-action-btn">
            <span>{project.published ? 'Unpublish' : 'Publish'}</span>
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
          box-shadow: 0 12px 24px rgba(0,0,0,0.1);
        }
        .card-action-btn {
          transition: all 0.2s ease;
        }
        .card-action-btn:hover {
          transform: translateY(-2px);
        }
      `}</style>
    </div>
  );
}

const styles: any = {
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    padding: '20px',
    border: '1px solid #E5E5EA',
    cursor: 'pointer',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px',
  },
  iconContainer: {
    width: '48px',
    height: '48px',
    backgroundColor: '#E3F2FF',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeContainer: {
    display: 'flex',
    gap: '8px',
  },
  badge: {
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: 600,
  },
  statusBadge: {},
  priorityBadge: {},
  projectName: {
    fontSize: '18px',
    fontWeight: 600,
    marginBottom: '8px',
    color: '#1C1C1E',
  },
  projectDescription: {
    fontSize: '14px',
    color: '#6C6C70',
    marginBottom: '16px',
    lineHeight: 1.4,
  },
  assignmentBlock: {
    backgroundColor: '#F9F9FB',
    borderRadius: '12px',
    padding: '12px',
    marginBottom: '16px',
  },
  assignmentText: {
    fontSize: '12px',
    color: '#6C6C70',
    margin: 0,
    marginBottom: '4px',
  },
  projectDetails: {
    display: 'flex',
    gap: '16px',
    marginBottom: '20px',
    paddingBottom: '16px',
    borderBottom: '1px solid #E5E5EA',
  },
  updateBox: {
    backgroundColor: '#F9F9FB',
    borderRadius: '12px',
    padding: '12px',
    marginBottom: '16px',
  },
  updateLabel: {
    fontSize: '12px',
    color: '#8E8E93',
    margin: 0,
    marginBottom: '6px',
  },
  updateText: {
    fontSize: '13px',
    color: '#1C1C1E',
    margin: 0,
  },
  detailItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  detailText: {
    fontSize: '12px',
    color: '#8E8E93',
  },
  cardActions: {
    display: 'flex',
    gap: '12px',
  },
  editBtn: {
    flex: 1,
    padding: '8px',
    backgroundColor: '#F2F2F7',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 500,
    color: '#007AFF',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    fontFamily: 'inherit',
  },
  publishBtn: {
    flex: 1,
    padding: '8px',
    backgroundColor: '#E8FFF3',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 500,
    color: '#16A34A',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    fontFamily: 'inherit',
  },
  deleteBtn: {
    flex: 1,
    padding: '8px',
    backgroundColor: '#FEF2F0',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 500,
    color: '#FF3B30',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    fontFamily: 'inherit',
  },
};
