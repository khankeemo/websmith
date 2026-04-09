// C:\websmith\app\projects\components\ProjectModal.tsx
// Project Modal - Form for adding/editing projects
// Features: Form validation, status/priority dropdowns, date pickers

'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Project } from '../services/projectService';
import { getUsersByRole, RoleUser } from '../../../core/services/userService';
import { getStoredUser } from '../../../lib/auth';

type ProjectStatus = 'pending' | 'in-progress' | 'completed' | 'on-hold';
type ProjectPriority = 'low' | 'medium' | 'high';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (project: any) => void;
  project?: Project | null;
}

const statusOptions: { value: ProjectStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'on-hold', label: 'On Hold' },
];

const priorityOptions: { value: ProjectPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

interface FormData {
  name: string;
  description: string;
  client: string;
  clientId: string;
  assignedDevId: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  startDate: string;
  endDate: string;
  expectedCompletionDate: string;
  budget: string;
  customClientId: string;
}

export default function ProjectModal({ isOpen, onClose, onSave, project }: ProjectModalProps) {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    client: '',
    clientId: '',
    assignedDevId: '',
    status: 'pending',
    priority: 'medium',
    startDate: '',
    endDate: '',
    expectedCompletionDate: '',
    budget: '',
    customClientId: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [clients, setClients] = useState<RoleUser[]>([]);
  const [developers, setDevelopers] = useState<RoleUser[]>([]);

  useEffect(() => {
    const currentUser = getStoredUser();
    if (!isOpen || currentUser?.role !== 'admin') return;

    const loadAssignments = async () => {
      try {
        const [clientUsers, developerUsers] = await Promise.all([
          getUsersByRole('client'),
          getUsersByRole('developer'),
        ]);
        setClients(clientUsers);
        setDevelopers(developerUsers);
      } catch (error) {
        console.error('Load assignment users error:', error);
      }
    };

    loadAssignments();
  }, [isOpen]);

  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name || '',
        description: project.description || '',
        client: project.client || '',
        clientId: project.clientId || '',
        assignedDevId: project.assignedDevId || '',
        status: project.status || 'pending',
        priority: project.priority || 'medium',
        startDate: project.startDate?.split('T')[0] || '',
        endDate: project.endDate?.split('T')[0] || '',
        expectedCompletionDate: project.expectedCompletionDate?.split('T')[0] || '',
        budget: project.budget?.toString() || '',
        customClientId: project.customClientId || '',
      });
    } else {
      setFormData({
        name: '',
        description: '',
        client: '',
        clientId: '',
        assignedDevId: '',
        status: 'pending',
        priority: 'medium',
        startDate: '',
        endDate: '',
        expectedCompletionDate: '',
        budget: '',
        customClientId: '',
      });
    }
    setErrors({});
  }, [project, isOpen]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Project name is required';
    if (!formData.description.trim()) newErrors.description = 'Description is required';
    if (!formData.client.trim()) newErrors.client = 'Client name is required';
    if (!formData.customClientId.trim()) newErrors.customClientId = 'Client ID (e.g. CL-0001) is required';
    if (!formData.startDate) newErrors.startDate = 'Start date is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const submitData = {
      ...formData,
      budget: formData.budget ? parseFloat(formData.budget) : undefined,
    };
    onSave(submitData);
  };

  const updateField = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  if (!isOpen) return null;

  const handleClientChange = (id: string) => {
    const selectedClient = clients.find((client) => client._id === id);
    setFormData((prev) => ({
      ...prev,
      clientId: id,
      customClientId: selectedClient?.customId || '',
      client: selectedClient?.name || '',
    }));
    if (errors.clientId || errors.client) {
      setErrors((prev) => ({ ...prev, clientId: '', client: '' }));
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>{project ? 'Edit Project' : 'New Project'}</h2>
          <button onClick={onClose} style={styles.closeBtn}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Project Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              style={{ ...styles.input, ...(errors.name ? styles.inputError : {}) }}
              placeholder="e.g., E-commerce Website"
            />
            {errors.name && <p style={styles.errorText}>{errors.name}</p>}
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Description *</label>
            <textarea
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              style={{ ...styles.textarea, ...(errors.description ? styles.inputError : {}) }}
              placeholder="Brief description of the project"
              rows={3}
            />
            {errors.description && <p style={styles.errorText}>{errors.description}</p>}
          </div>

          <div style={styles.row}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Client Selection *</label>
              <select
                value={formData.clientId}
                onChange={(e) => handleClientChange(e.target.value)}
                style={{ ...styles.select, ...(errors.clientId ? styles.inputError : {}) }}
              >
                <option value="">Select client</option>
                {clients.map((client) => (
                  <option key={client._id} value={client._id}>
                    {client.customId ? `[${client.customId}] ` : ''}{client.name} ({client.email})
                  </option>
                ))}
              </select>
              {errors.clientId && <p style={styles.errorText}>{errors.clientId}</p>}
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Client ID *</label>
              <input
                type="text"
                value={formData.customClientId}
                onChange={(e) => updateField('customClientId', e.target.value)}
                placeholder="e.g., CL-0001"
                style={{ ...styles.input, ...(errors.customClientId ? styles.inputError : {}) }}
              />
              {errors.customClientId && <p style={styles.errorText}>{errors.customClientId}</p>}
            </div>
          </div>

          <div style={styles.row}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Status</label>
              <select
                value={formData.status}
                onChange={(e) => updateField('status', e.target.value as ProjectStatus)}
                style={styles.select}
              >
                {statusOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Assigned Developer</label>
              <select
                value={formData.assignedDevId}
                onChange={(e) => updateField('assignedDevId', e.target.value)}
                style={styles.select}
              >
                <option value="">Unassigned</option>
                {developers.map((developer) => (
                  <option key={developer._id} value={developer._id}>
                    {developer.name} ({developer.email})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={styles.row}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Start Date *</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => updateField('startDate', e.target.value)}
                style={{ ...styles.input, ...(errors.startDate ? styles.inputError : {}) }}
              />
              {errors.startDate && <p style={styles.errorText}>{errors.startDate}</p>}
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => updateField('priority', e.target.value as ProjectPriority)}
                style={styles.select}
              >
                {priorityOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={styles.row}>
            <div style={styles.formGroup}>
              <label style={styles.label}>End Date</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => updateField('endDate', e.target.value)}
                style={styles.input}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Estimation Delivery Date *</label>
              <input
                type="date"
                value={formData.expectedCompletionDate}
                onChange={(e) => updateField('expectedCompletionDate', e.target.value)}
                style={{ ...styles.input, ...(errors.expectedCompletionDate ? styles.inputError : {}) }}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Budget ($)</label>
              <input
                type="number"
                value={formData.budget}
                onChange={(e) => updateField('budget', e.target.value)}
                style={styles.input}
                placeholder="e.g., 5000"
              />
            </div>
          </div>

          <div style={styles.modalFooter}>
            <button type="button" onClick={onClose} style={styles.cancelBtn}>Cancel</button>
            <button type="submit" style={styles.saveBtn}>Save Project</button>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes modalFadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}

const styles: any = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderRadius: '24px',
    padding: '28px',
    width: '90%',
    maxWidth: '600px',
    maxHeight: '90vh',
    overflowY: 'auto',
    animation: 'modalFadeIn 0.3s ease',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  modalTitle: {
    fontSize: '24px',
    fontWeight: 600,
    color: '#1C1C1E',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#8E8E93',
    padding: '4px',
  },
  formGroup: {
    marginBottom: '20px',
    flex: 1,
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: 500,
    color: '#1C1C1E',
    marginBottom: '8px',
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    fontSize: '15px',
    border: '1.5px solid #E5E5EA',
    borderRadius: '12px',
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'all 0.2s ease',
  },
  textarea: {
    width: '100%',
    padding: '12px 16px',
    fontSize: '15px',
    border: '1.5px solid #E5E5EA',
    borderRadius: '12px',
    outline: 'none',
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  select: {
    width: '100%',
    padding: '12px 16px',
    fontSize: '15px',
    border: '1.5px solid #E5E5EA',
    borderRadius: '12px',
    outline: 'none',
    fontFamily: 'inherit',
    backgroundColor: '#FFFFFF',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  errorText: {
    fontSize: '12px',
    color: '#FF3B30',
    marginTop: '6px',
  },
  row: {
    display: 'flex',
    gap: '16px',
  },
  modalFooter: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
    marginTop: '24px',
    paddingTop: '16px',
    borderTop: '1px solid #E5E5EA',
  },
  cancelBtn: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 500,
    backgroundColor: '#F2F2F7',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  saveBtn: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 600,
    backgroundColor: '#007AFF',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};
