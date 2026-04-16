// PATH: C:\websmith\app\team\page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, X, Users, UserCheck, Code, Trash2, Edit2, Phone, Mail, Briefcase } from 'lucide-react';
import API from '@/core/services/apiService';
import { RoleUser, getUsersByRole, createDeveloper, deleteManagedUser, updateDeveloper, DeveloperPayload } from '@/core/services/userService';
import { ViewModeToggle, GridListView } from '@/components/ui/ViewModeToggle';

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

// Developer interface (using RoleUser from core)
// interface TeamMember { ... } is replaced by RoleUser

// Developer Card Component
const DeveloperCard = ({
  dev,
  onDelete,
  onEdit,
  onTogglePublish,
}: {
  dev: RoleUser;
  onDelete: (id: string) => void;
  onEdit: (dev: RoleUser) => void;
  onTogglePublish: (dev: RoleUser) => void;
}) => {
  const topSkills = (dev.skills || []).slice(0, 4);
  const hasMoreSkills = (dev.skills || []).length > 4;

  return (
    <div style={styles.card} className="team-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '20px' }}>
        <div style={{
          width: '64px', height: '64px', borderRadius: '18px',
          background: `linear-gradient(135deg, #007AFF20, #007AFF40)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px',
          fontWeight: '700', color: '#007AFF', border: `1.5px solid #007AFF20`
        }}>
          {dev.name.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '-0.3px' }}>{dev.name}</h3>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Badge text={dev.role} color="#007AFF" />
            <Badge text={dev.status || "active"} color={dev.status === "inactive" ? "#FF9500" : "#34C759"} />
            <Badge text={dev.published ? "published" : "draft"} color={dev.published ? "#34C759" : "#8E8E93"} />
          </div>
        </div>
      </div>
      
      <div style={styles.cardDetails}>
        <div style={styles.detailItem}><Mail size={14} color="var(--text-secondary)" /><span style={styles.detailText}>{dev.email}</span></div>
        {dev.phone && <div style={styles.detailItem}><Phone size={14} color="var(--text-secondary)" /><span style={styles.detailText}>{dev.phone}</span></div>}
        <div style={styles.detailItem}><Briefcase size={14} color="var(--text-secondary)" /><span style={styles.detailText}>{dev.company || 'Private Entity'}</span></div>
        {dev.headline && (
          <div style={styles.detailItem}>
            <Code size={14} color="var(--text-secondary)" />
            <span style={styles.detailText}>{dev.headline}</span>
          </div>
        )}
        <div style={styles.detailItem}>
          <Users size={14} color="var(--text-secondary)" />
          <span style={styles.detailText}>Experience: {dev.experienceYears || 0} years</span>
        </div>
      </div>

      {(topSkills.length > 0 || dev.bio) && (
        <div style={styles.cardExtra}>
          {topSkills.length > 0 && (
            <div style={styles.skillsWrap}>
              {topSkills.map((skill) => (
                <span key={`${dev._id}-${skill}`} style={styles.skillPill}>
                  {skill}
                </span>
              ))}
              {hasMoreSkills ? <span style={styles.moreSkills}>+{(dev.skills || []).length - 4} more</span> : null}
            </div>
          )}
          {dev.bio ? <p style={styles.bioText}>{dev.bio}</p> : null}
        </div>
      )}

      <div style={styles.cardActions}>
        <button type="button" onClick={() => onTogglePublish(dev)} style={styles.publishCardBtn} className="action-btn">
          <span>{dev.published ? 'Unpublish' : 'Publish'}</span>
        </button>
        <button type="button" onClick={() => onEdit(dev)} style={styles.editBtn} className="action-btn">
          <Edit2 size={16} /> <span>Edit</span>
        </button>
        <button type="button" onClick={() => onDelete(dev._id)} style={styles.deleteBtn} className="action-btn">
          <Trash2 size={16} /> <span>Remove</span>
        </button>
      </div>
    </div>
  );
};

// Developer Modal Component
const DeveloperModal = ({
  isOpen,
  onClose,
  onSubmit,
  isSaving,
  editingUser,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: DeveloperPayload) => void;
  isSaving: boolean;
  editingUser: RoleUser | null;
}) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    skills: [] as string[],
    skillInput: '',
    experienceYears: 0,
    headline: '',
    bio: '',
    status: 'active' as 'active' | 'inactive' | 'on-leave',
    published: false,
  });
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (editingUser) {
        setFormData({
          name: editingUser.name,
          email: editingUser.email,
          phone: editingUser.phone || '',
          company: editingUser.company || '',
          skills: editingUser.skills || [],
          skillInput: '',
          experienceYears: editingUser.experienceYears || 0,
          headline: editingUser.headline || '',
          bio: editingUser.bio || '',
          status: editingUser.status || 'active',
          published: editingUser.published || false,
        });
      } else {
        setFormData({
          name: '',
          email: '',
          phone: '',
          company: '',
          skills: [],
          skillInput: '',
          experienceYears: 0,
          headline: '',
          bio: '',
          status: 'active',
          published: false,
        });
      }
      setLocalError('');
    }
  }, [isOpen, editingUser]);

  if (!isOpen) return null;

  const addSkill = () => {
    const skill = formData.skillInput.trim();
    if (!skill || formData.skills.includes(skill)) return;
    setFormData((prev) => ({ ...prev, skills: [...prev.skills, skill], skillInput: '' }));
  };

  const removeSkill = (skill: string) => {
    setFormData((prev) => ({ ...prev, skills: prev.skills.filter((item) => item !== skill) }));
  };

  const buildPayload = (publish = false): DeveloperPayload | null => {
    const name = formData.name.trim();
    const email = formData.email.trim().toLowerCase();
    const phone = formData.phone.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^[+]?[0-9()\-\s]{7,20}$/;

    if (!name) {
      setLocalError('Developer name is required.');
      return null;
    }
    if (!emailRegex.test(email)) {
      setLocalError('Please enter a valid Email ID.');
      return null;
    }
    if (phone && !phoneRegex.test(phone)) {
      setLocalError('Please enter a valid phone number.');
      return null;
    }

    setLocalError('');
    return {
      name,
      email,
      phone,
      company: formData.company.trim(),
      skills: formData.skills,
      experienceYears: Number(formData.experienceYears) || 0,
      headline: formData.headline.trim(),
      bio: formData.bio.trim(),
      status: formData.status,
      published: publish ? true : formData.published,
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = buildPayload(false);
    if (!payload) return;
    onSubmit(payload);
  };

  const handlePublish = () => {
    const payload = buildPayload(true);
    if (!payload) return;
    onSubmit(payload);
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>{editingUser ? 'Edit Developer' : 'Add New Developer'}</h2>
          <button onClick={onClose} style={styles.closeBtn}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <label style={styles.inputLabel}>Developer Name</label>
              <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required style={styles.input} placeholder="John Doe" />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.inputLabel}>Email ID</label>
              <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} required style={styles.input} placeholder="john@example.com" />
            </div>
          </div>
          
          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <label style={styles.inputLabel}>Phone Number</label>
              <input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} style={styles.input} placeholder="+1 234 567 890" />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.inputLabel}>Role</label>
              <input type="text" value={formData.headline} onChange={e => setFormData({ ...formData, headline: e.target.value })} style={styles.input} placeholder="Senior Full-Stack Developer" />
            </div>
          </div>

          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <label style={styles.inputLabel}>Experience (years)</label>
              <input type="number" min={0} value={formData.experienceYears} onChange={e => setFormData({ ...formData, experienceYears: Number(e.target.value) || 0 })} style={styles.input} placeholder="3" />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.inputLabel}>Status</label>
              <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as any })} style={styles.select}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="on-leave">On Leave</option>
              </select>
            </div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.inputLabel}>Skills</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="text" value={formData.skillInput} onChange={e => setFormData({ ...formData, skillInput: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }} style={styles.input} placeholder="Add skill and press Enter" />
              <button type="button" onClick={addSkill} style={styles.skillAddBtn}>Add</button>
            </div>
            {formData.skills.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                {formData.skills.map((skill) => (
                  <span key={skill} style={styles.skillChip}>
                    {skill}
                    <button type="button" onClick={() => removeSkill(skill)} style={styles.skillRemoveBtn}>x</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div style={styles.formGroup}>
              <label style={styles.inputLabel}>Company / Org</label>
              <input type="text" value={formData.company} onChange={e => setFormData({ ...formData, company: e.target.value })} style={styles.input} placeholder="Freelance / Tech Co" />
            </div>

          <div style={styles.formGroup}>
            <label style={styles.inputLabel}>Description</label>
            <textarea
              value={formData.bio}
              onChange={e => setFormData({ ...formData, bio: e.target.value })}
              style={{ ...styles.input, minHeight: '90px', resize: 'vertical' as const }}
              placeholder="Write a short developer description..."
            />
          </div>

          {localError ? <p style={{ color: '#FF3B30', fontSize: '13px', margin: '4px 0' }}>{localError}</p> : null}

          {!editingUser && (
            <div style={styles.infoBox}>
              <p style={styles.infoText}>
                <strong>Note:</strong> Saving this developer will email their login credentials automatically.
              </p>
            </div>
          )}

          <div style={styles.modalFooter}>
            <button type="button" onClick={onClose} style={styles.modalCancelBtn} disabled={isSaving}>Cancel</button>
            <button type="button" onClick={handlePublish} style={styles.publishBtn} disabled={isSaving}>
              {isSaving ? 'Processing...' : 'Publish'}
            </button>
            <button type="submit" style={styles.modalSubmitBtn} disabled={isSaving}>
              {isSaving ? 'Processing...' : editingUser ? 'Save changes' : 'Add Developer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Main Page Component
export default function DevelopersPage() {
  const [developers, setDevelopers] = useState<RoleUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<RoleUser | null>(null);
  const [viewMode, setViewMode] = useState<GridListView>('grid');
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    setToken(typeof window !== 'undefined' ? localStorage.getItem('token') : null);
  }, []);

  const fetchDevelopers = useCallback(async () => {
    try {
      const users = await getUsersByRole('developer');
      setDevelopers(users);
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevelopers();
  }, [fetchDevelopers]);

  const handleSaveDeveloper = async (data: DeveloperPayload) => {
    setSaving(true);
    try {
      if (editingUser) {
        await updateDeveloper(editingUser._id, {
          name: data.name,
          email: data.email,
          phone: data.phone,
          company: data.company,
          skills: data.skills,
          experienceYears: data.experienceYears,
          headline: data.headline,
          bio: data.bio,
          status: data.status,
          published: data.published,
        });
        setEditingUser(null);
      } else {
        await createDeveloper(data);
        setIsModalOpen(false);
      }
      await fetchDevelopers();
    } catch (error: any) {
      console.error('Save developer error:', error);
      const msg = error?.response?.data?.message || error?.message || 'Request failed';
      alert(editingUser ? `Failed to update developer: ${msg}` : `Failed to add developer: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveDeveloper = async (id: string) => {
    if (!confirm('Are you sure you want to remove this developer? This will delete their account access.')) return;
    try {
      await deleteManagedUser(id);
      await fetchDevelopers();
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete developer.');
    }
  };

  const handleTogglePublish = async (dev: RoleUser) => {
    try {
      await updateDeveloper(dev._id, { published: !dev.published });
      await fetchDevelopers();
    } catch (error) {
      console.error('Toggle publish error:', error);
      alert('Failed to update publish status.');
    }
  };

  const filteredDevelopers = developers.filter(d =>
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (d.company && d.company.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const stats = {
    total: developers.length,
    active: developers.length, // All role users are technically active
    specialists: developers.length,
  };

  if (!token) {
    return <div style={{ padding: '80px', textAlign: 'center', color: 'var(--text-secondary)' }}>Please login to view technical staff</div>;
  }

  if (loading) {
    return (
      <div style={styles.loadingWrapper}>
        <div style={styles.spinner}></div>
        <p>Syncing developer database...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.pageTitle}>Developers</h1>
          <p style={styles.pageSubtitle}>Manage your technical workforce and role-based access</p>
        </div>
        <button
          onClick={() => {
            setEditingUser(null);
            setIsModalOpen(true);
          }}
          style={styles.primaryBtn}
        >
          <Plus size={20} /> Add Developer
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
          <div><div style={styles.statValue}>{stats.specialists}</div><div style={styles.statLabel}>Active Specialists</div></div>
        </div>
      </div>

      <div style={styles.searchSection}>
        <div style={styles.searchInner}>
          <Search size={18} style={styles.searchIcon} />
          <input type="text" placeholder="Search by name, email or skills..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={styles.searchInput} />
        </div>
        <ViewModeToggle value={viewMode} onChange={setViewMode} />
      </div>

      {filteredDevelopers.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>👨‍💻</div>
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>No developers found</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Try adjusting your search or add a new developer.</p>
          <button
            onClick={() => {
              setEditingUser(null);
              setIsModalOpen(true);
            }}
            style={styles.primaryBtn}
          >
            Add your first developer
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div style={styles.teamGrid}>
          {filteredDevelopers.map(dev => (
            <DeveloperCard
              key={dev._id}
              dev={dev}
              onDelete={handleRemoveDeveloper}
              onTogglePublish={handleTogglePublish}
              onEdit={(d) => {
                setIsModalOpen(false);
                setEditingUser(d);
              }}
            />
          ))}
        </div>
      ) : (
        <div style={styles.devList}>
          {filteredDevelopers.map((dev) => (
            <div key={dev._id} style={styles.devListRow}>
              <div style={styles.devListMain}>
                <strong style={styles.devListName}>{dev.name}</strong>
                <span style={styles.devListMeta}>{dev.email}</span>
              </div>
              <div style={styles.devListActions}>
                <button type="button" onClick={() => handleTogglePublish(dev)} style={styles.devListPublish}>
                  {dev.published ? 'Unpublish' : 'Publish'}
                </button>
                <button type="button" onClick={() => { setIsModalOpen(false); setEditingUser(dev); }} style={styles.devListEdit}>Edit</button>
                <button type="button" onClick={() => handleRemoveDeveloper(dev._id)} style={styles.devListRemove}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <DeveloperModal
        isOpen={isModalOpen || !!editingUser}
        onClose={() => {
          setIsModalOpen(false);
          setEditingUser(null);
        }}
        onSubmit={handleSaveDeveloper}
        isSaving={saving}
        editingUser={editingUser}
      />

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
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap' as const,
  },
  searchInner: {
    position: 'relative',
    flex: 1,
    minWidth: '220px',
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
  devList: { display: 'flex', flexDirection: 'column' as const, gap: '10px' },
  devListRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '14px 16px',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: '14px',
    border: '1px solid var(--border-color)',
    flexWrap: 'wrap' as const,
  },
  devListMain: { display: 'flex', flexDirection: 'column' as const, gap: '4px', minWidth: 0, flex: 1 },
  devListName: { fontSize: '15px', color: 'var(--text-primary)' },
  devListMeta: { fontSize: '13px', color: 'var(--text-secondary)' },
  devListActions: { display: 'flex', gap: '8px' },
  devListPublish: {
    padding: '8px 14px',
    borderRadius: '10px',
    border: 'none',
    background: '#34C759',
    color: '#fff',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  devListEdit: {
    padding: '8px 14px',
    borderRadius: '10px',
    border: 'none',
    background: '#007AFF',
    color: '#fff',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  devListRemove: {
    padding: '8px 14px',
    borderRadius: '10px',
    border: '1px solid rgba(255,59,48,0.35)',
    background: 'transparent',
    color: '#FF3B30',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
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
  cardExtra: {
    marginBottom: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  skillsWrap: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  skillPill: {
    padding: '4px 10px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 700,
    backgroundColor: 'rgba(0,122,255,0.1)',
    color: '#007AFF',
    border: '1px solid rgba(0,122,255,0.18)',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  moreSkills: {
    padding: '4px 10px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 700,
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-color)',
  },
  bioText: {
    margin: 0,
    fontSize: '12px',
    lineHeight: 1.5,
    color: 'var(--text-secondary)',
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
  publishCardBtn: {
    flex: 1,
    padding: '12px',
    background: 'rgba(52, 199, 89, 0.1)',
    color: '#1F9E4B',
    border: '1px solid rgba(52, 199, 89, 0.25)',
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
  publishBtn: {
    flex: 1,
    padding: '16px',
    background: '#34C759',
    color: 'white',
    border: 'none',
    borderRadius: '16px',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 8px 20px rgba(52,199,89,0.2)'
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
  infoBox: {
    padding: '16px',
    backgroundColor: 'rgba(0, 122, 255, 0.05)',
    borderRadius: '12px',
    border: '1px solid rgba(0, 122, 255, 0.1)',
    marginBottom: '20px'
  },
  infoText: {
    fontSize: '13px',
    color: '#007AFF',
    margin: 0,
    lineHeight: '1.5'
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