// PATH: C:\websmith\app\team\page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, X, Users, UserCheck, Code, Trash2, Edit2, Phone, Mail, Briefcase } from 'lucide-react';
import API from '@/core/services/apiService';

// Simple Badge component
const Badge = ({ text, color }: { text: string; color: string }) => (
  <span style={{
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: '700',
    backgroundColor: `${color}15`,
    color: color,
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  }}>
    {text}
  </span>
);

// Team Member interface
interface TeamMember {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  department: string;
  skills: string[];
  experience: number;
  joinDate: string;
  status: string;
  bio?: string;
}

// Simple Team Card Component
const TeamCard = ({ member, onEdit, onDelete }: { member: TeamMember; onEdit: (m: TeamMember) => void; onDelete: (id: string) => void }) => {
  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      admin: '#FF3B30', developer: '#007AFF', designer: '#AF52DE',
      manager: '#FF9500', intern: '#34C759'
    };
    return colors[role] || 'var(--text-secondary)';
  };

  return (
    <div style={styles.card} className="team-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '20px' }}>
        <div style={{
          width: '64px', height: '64px', borderRadius: '18px',
          background: `linear-gradient(135deg, ${getRoleColor(member.role)}20, ${getRoleColor(member.role)}40)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px',
          fontWeight: '700', color: getRoleColor(member.role), border: `1.5px solid ${getRoleColor(member.role)}20`
        }}>
          {member.name.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '-0.3px' }}>{member.name}</h3>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Badge text={member.role} color={getRoleColor(member.role)} />
            <Badge text={member.status} color={member.status === 'active' ? '#34C759' : 'var(--text-secondary)'} />
          </div>
        </div>
      </div>
      
      <div style={styles.cardDetails}>
        <div style={styles.detailItem}><Mail size={14} color="var(--text-secondary)" /><span style={styles.detailText}>{member.email}</span></div>
        {member.phone && <div style={styles.detailItem}><Phone size={14} color="var(--text-secondary)" /><span style={styles.detailText}>{member.phone}</span></div>}
        <div style={styles.detailItem}><Briefcase size={14} color="var(--text-secondary)" /><span style={styles.detailText}>{member.department} • {member.experience}y Exp</span></div>
      </div>

      <div style={styles.cardActions}>
        <button onClick={() => onEdit(member)} style={styles.editBtn} className="action-btn">
          <Edit2 size={16} /> <span>Edit</span>
        </button>
        <button onClick={() => onDelete(member._id)} style={styles.deleteBtn} className="action-btn">
          <Trash2 size={16} /> <span>Delete</span>
        </button>
      </div>
    </div>
  );
};

// Simple Modal Component
const TeamModal = ({ isOpen, onClose, onSubmit, editingMember }: any) => {
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', role: 'developer', department: 'development',
    skills: [] as string[], experience: 0, joinDate: new Date().toISOString().split('T')[0], status: 'active', bio: ''
  });
  const [skillInput, setSkillInput] = useState('');

  useEffect(() => {
    if (editingMember) {
      setFormData({
        name: editingMember.name, email: editingMember.email, phone: editingMember.phone || '',
        role: editingMember.role, department: editingMember.department, skills: editingMember.skills,
        experience: editingMember.experience, joinDate: editingMember.joinDate.split('T')[0],
        status: editingMember.status, bio: editingMember.bio || ''
      });
    } else {
      setFormData({
        name: '', email: '', phone: '', role: 'developer', department: 'development',
        skills: [], experience: 0, joinDate: new Date().toISOString().split('T')[0],
        status: 'active', bio: ''
      });
    }
  }, [editingMember, isOpen]);

  if (!isOpen) return null;

  const addSkill = () => { if (skillInput.trim()) { setFormData({ ...formData, skills: [...formData.skills, skillInput.trim()] }); setSkillInput(''); } };
  const removeSkill = (skill: string) => setFormData({ ...formData, skills: formData.skills.filter(s => s !== skill) });
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSubmit(formData); };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>{editingMember ? 'Edit Team Member' : 'Add Team Member'}</h2>
          <button onClick={onClose} style={styles.closeBtn}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <label style={styles.inputLabel}>Full Name</label>
              <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required style={styles.input} />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.inputLabel}>Email Address</label>
              <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} required style={styles.input} />
            </div>
          </div>
          
          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <label style={styles.inputLabel}>Phone Number</label>
              <input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} style={styles.input} />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.inputLabel}>Experience (Year)</label>
              <input type="number" value={formData.experience} onChange={e => setFormData({ ...formData, experience: parseInt(e.target.value) })} style={styles.input} />
            </div>
          </div>

          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <label style={styles.inputLabel}>Role</label>
              <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })} style={styles.select}>
                <option value="admin">Admin</option><option value="developer">Developer</option>
                <option value="designer">Designer</option><option value="manager">Manager</option><option value="intern">Intern</option>
              </select>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.inputLabel}>Department</label>
              <select value={formData.department} onChange={e => setFormData({ ...formData, department: e.target.value })} style={styles.select}>
                <option value="development">Development</option><option value="design">Design</option>
                <option value="management">Management</option><option value="sales">Sales</option><option value="support">Support</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={styles.inputLabel}>Skills</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input type="text" placeholder="e.g. React" value={skillInput} onChange={e => setSkillInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addSkill())} style={styles.input} />
              <button type="button" onClick={addSkill} style={styles.skillAddBtn}>Add</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {formData.skills.map((s, i) => (<span key={i} style={styles.skillChip}>{s} <button type="button" onClick={() => removeSkill(s)} style={styles.skillRemoveBtn}>×</button></span>))}
            </div>
          </div>

          <textarea placeholder="Tell us a bit about this person..." value={formData.bio} onChange={e => setFormData({ ...formData, bio: e.target.value })} rows={3} style={{ ...styles.input, resize: 'none' }} />
          
          <div style={styles.modalFooter}>
            <button type="button" onClick={onClose} style={styles.modalCancelBtn}>Cancel</button>
            <button type="submit" style={styles.modalSubmitBtn}>{editingMember ? 'Update Member' : 'Add to Team'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Main Page Component
export default function TeamPage() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    setToken(localStorage.getItem('token'));
  }, []);

  const fetchTeamMembers = useCallback(async () => {
    try {
      const response = await API.get('/team');
      if (response.data.success || response.data.data) {
        setTeamMembers(response.data.data || []);
      }
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeamMembers();
  }, [fetchTeamMembers]);

  const createTeamMember = async (data: any) => {
    try {
      const response = await API.post('/team', data);
      if (response.status === 200 || response.status === 201) {
        await fetchTeamMembers();
        setIsModalOpen(false);
      }
    } catch (error) {
      console.error('Create error:', error);
    }
  };

  const updateTeamMember = async (id: string, data: any) => {
    try {
      const response = await API.put(`/team/${id}`, data);
      if (response.status === 200) {
        await fetchTeamMembers();
        setIsModalOpen(false);
        setEditingMember(null);
      }
    } catch (error) {
      console.error('Update error:', error);
    }
  };

  const deleteTeamMember = async (id: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return;
    try {
      const response = await API.delete(`/team/${id}`);
      if (response.status === 200) {
        await fetchTeamMembers();
      }
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const handleSubmit = (data: any) => {
    if (editingMember) {
      updateTeamMember(editingMember._id, data);
    } else {
      createTeamMember(data);
    }
  };

  const filteredMembers = teamMembers.filter(m =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: teamMembers.length,
    active: teamMembers.filter(m => m.status === 'active').length,
    developers: teamMembers.filter(m => m.role === 'developer').length,
  };

  if (!token) {
    return <div style={{ padding: '80px', textAlign: 'center', color: 'var(--text-secondary)' }}>Please login to view team members</div>;
  }

  if (loading) {
    return (
      <div style={styles.loadingWrapper}>
        <div style={styles.spinner}></div>
        <p>Syncing team database...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.pageTitle}>Team</h1>
          <p style={styles.pageSubtitle}>Manage your internal workforce and departments</p>
        </div>
        <button onClick={() => { setEditingMember(null); setIsModalOpen(true); }} style={styles.primaryBtn}>
          <Plus size={20} /> Add Member
        </button>
      </div>

      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <Users size={24} color="#007AFF" />
          <div><div style={styles.statValue}>{stats.total}</div><div style={styles.statLabel}>Total Members</div></div>
        </div>
        <div style={styles.statCard}>
          <UserCheck size={24} color="#34C759" />
          <div><div style={styles.statValue}>{stats.active}</div><div style={styles.statLabel}>Active Now</div></div>
        </div>
        <div style={styles.statCard}>
          <Code size={24} color="#AF52DE" />
          <div><div style={styles.statValue}>{stats.developers}</div><div style={styles.statLabel}>Developers</div></div>
        </div>
      </div>

      <div style={styles.searchSection}>
        <Search size={18} style={styles.searchIcon} />
        <input type="text" placeholder="Search by name, email or skills..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={styles.searchInput} />
      </div>

      {filteredMembers.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>👥</div>
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>No team members found</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Try adjusting your search or add a new teammate.</p>
          <button onClick={() => setIsModalOpen(true)} style={styles.primaryBtn}>Add your first member</button>
        </div>
      ) : (
        <div style={styles.teamGrid}>
          {filteredMembers.map(member => (
            <TeamCard key={member._id} member={member} onEdit={(m) => { setEditingMember(m); setIsModalOpen(true); }} onDelete={deleteTeamMember} />
          ))}
        </div>
      )}

      <TeamModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingMember(null); }} onSubmit={handleSubmit} editingMember={editingMember} />

      <style>{`
        .team-card { transition: all 0.3s ease; }
        .team-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0,0,0,0.08) !important; border-color: #007AFF55 !important; }
        .action-btn { transition: all 0.2s ease; }
        .action-btn:hover { opacity: 0.8; transform: scale(0.98); }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const styles: any = {
  container: {
    padding: '8px 4px',
    maxWidth: '1400px',
    margin: '0 auto',
    backgroundColor: 'var(--bg-primary)',
    minHeight: '100vh',
    color: 'var(--text-primary)',
  },
  pageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '40px',
  },
  pageTitle: {
    fontSize: '34px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '8px',
    letterSpacing: '-1px'
  },
  pageSubtitle: {
    fontSize: '15px',
    color: 'var(--text-secondary)'
  },
  primaryBtn: {
    padding: '12px 24px',
    backgroundColor: '#007AFF',
    color: 'white',
    border: 'none',
    borderRadius: '14px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontWeight: '700',
    boxShadow: '0 4px 12px rgba(0,122,255,0.2)'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '20px',
    marginBottom: '32px'
  },
  statCard: {
    background: 'var(--bg-primary)',
    borderRadius: '24px',
    padding: '24px',
    border: '1.5px solid var(--border-color)',
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
  },
  statValue: {
    fontSize: '28px',
    fontWeight: '800',
    color: 'var(--text-primary)',
    letterSpacing: '-1px'
  },
  statLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  searchSection: {
    marginBottom: '32px',
    position: 'relative'
  },
  searchIcon: {
    position: 'absolute',
    left: '18px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'var(--text-secondary)'
  },
  searchInput: {
    width: '100%',
    padding: '16px 20px 16px 52px',
    backgroundColor: 'var(--bg-primary)',
    border: '1.5px solid var(--border-color)',
    borderRadius: '16px',
    fontSize: '16px',
    color: 'var(--text-primary)',
    outline: 'none',
    boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
  },
  teamGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
    gap: '24px'
  },
  card: {
    background: 'var(--bg-primary)',
    borderRadius: '24px',
    padding: '28px',
    border: '1.5px solid var(--border-color)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)'
  },
  cardDetails: {
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: '16px',
    padding: '16px',
    marginBottom: '24px',
    border: '1px solid var(--border-color)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  detailItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  detailText: {
    fontSize: '14px',
    color: 'var(--text-primary)',
    fontWeight: '500'
  },
  cardActions: {
    display: 'flex',
    gap: '12px',
    paddingTop: '20px',
    borderTop: '1.5px solid var(--border-color)'
  },
  editBtn: {
    flex: 1,
    padding: '12px',
    background: 'var(--bg-secondary)',
    color: '#007AFF',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: '700',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px'
  },
  deleteBtn: {
    flex: 1,
    padding: '12px',
    background: 'rgba(255, 59, 48, 0.05)',
    color: '#FF3B30',
    border: '1px solid rgba(255, 59, 48, 0.1)',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: '700',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px'
  },
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modal: {
    background: 'var(--bg-primary)',
    borderRadius: '32px',
    width: '95%',
    maxWidth: '680px',
    maxHeight: '90vh',
    overflow: 'auto',
    padding: '32px',
    boxShadow: '0 24px 60px rgba(0,0,0,0.2)',
    border: '1px solid var(--border-color)'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '28px'
  },
  modalTitle: {
    fontSize: '26px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    letterSpacing: '-1px'
  },
  closeBtn: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    cursor: 'pointer',
    padding: '8px',
    color: 'var(--text-secondary)'
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '20px',
    marginBottom: '16px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  inputLabel: {
    fontSize: '13px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    backgroundColor: 'var(--bg-secondary)',
    border: '1.5px solid var(--border-color)',
    borderRadius: '14px',
    fontSize: '15px',
    color: 'var(--text-primary)',
    outline: 'none'
  },
  select: {
    width: '100%',
    padding: '14px 16px',
    backgroundColor: 'var(--bg-secondary)',
    border: '1.5px solid var(--border-color)',
    borderRadius: '14px',
    fontSize: '15px',
    color: 'var(--text-primary)',
    outline: 'none',
    appearance: 'none'
  },
  skillAddBtn: {
    padding: '0 24px',
    background: '#007AFF',
    color: 'white',
    border: 'none',
    borderRadius: '14px',
    fontWeight: '700',
    cursor: 'pointer'
  },
  skillChip: {
    padding: '6px 14px',
    background: 'rgba(0, 122, 255, 0.1)',
    color: '#007AFF',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: '600',
    border: '1px solid rgba(0, 122, 255, 0.1)'
  },
  skillRemoveBtn: {
    background: 'none',
    border: 'none',
    marginLeft: '6px',
    cursor: 'pointer',
    color: '#007AFF',
    fontWeight: '700'
  },
  modalFooter: {
    display: 'flex',
    gap: '12px',
    marginTop: '32px'
  },
  modalCancelBtn: {
    flex: 1,
    padding: '16px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '16px',
    fontWeight: '700',
    color: 'var(--text-secondary)',
    cursor: 'pointer'
  },
  modalSubmitBtn: {
    flex: 1,
    padding: '16px',
    background: '#007AFF',
    color: 'white',
    border: 'none',
    borderRadius: '16px',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 8px 20px rgba(0,122,255,0.2)'
  },
  emptyState: {
    textAlign: 'center',
    padding: '100px 40px',
    background: 'var(--bg-secondary)',
    borderRadius: '32px',
    border: '1.5px dashed var(--border-color)'
  },
  loadingWrapper: {
    padding: '100px 40px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
    color: 'var(--text-secondary)'
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid var(--border-color)',
    borderTopColor: '#007AFF',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite'
  }
};