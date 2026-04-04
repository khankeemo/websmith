// PATH: C:\websmith\app\team\page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, X, Users, UserCheck, Code, Building } from 'lucide-react';

// Simple Badge component inline to avoid import issues
const Badge = ({ text, color }: { text: string; color: string }) => (
  <span style={{
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '500',
    backgroundColor: `${color}15`,
    color: color,
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
    return colors[role] || '#8E8E93';
  };

  return (
    <div style={{
      background: '#FFFFFF', borderRadius: '20px', padding: '20px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)', border: '1px solid #E5E5EA'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
        <div style={{
          width: '60px', height: '60px', borderRadius: '30px',
          background: `linear-gradient(135deg, ${getRoleColor(member.role)}20, ${getRoleColor(member.role)}40)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px',
          color: getRoleColor(member.role)
        }}>
          {member.name.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1C1C1E', marginBottom: '4px' }}>{member.name}</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Badge text={member.role} color={getRoleColor(member.role)} />
            <Badge text={member.status} color={member.status === 'active' ? '#34C759' : '#8E8E93'} />
          </div>
        </div>
      </div>
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '14px', color: '#3A3A3C', marginBottom: '4px' }}>📧 {member.email}</div>
        {member.phone && <div style={{ fontSize: '14px', color: '#3A3A3C', marginBottom: '4px' }}>📞 {member.phone}</div>}
        <div style={{ fontSize: '14px', color: '#3A3A3C' }}>💼 {member.department} • {member.experience} years</div>
      </div>
      <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid #E5E5EA', paddingTop: '16px' }}>
        <button onClick={() => onEdit(member)} style={{ flex: 1, padding: '10px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer' }}>✏️ Edit</button>
        <button onClick={() => onDelete(member._id)} style={{ flex: 1, padding: '10px', background: '#FF3B30', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer' }}>🗑️ Delete</button>
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

  React.useEffect(() => {
    if (editingMember) {
      setFormData({
        name: editingMember.name, email: editingMember.email, phone: editingMember.phone || '',
        role: editingMember.role, department: editingMember.department, skills: editingMember.skills,
        experience: editingMember.experience, joinDate: editingMember.joinDate.split('T')[0],
        status: editingMember.status, bio: editingMember.bio || ''
      });
    }
  }, [editingMember]);

  if (!isOpen) return null;

  const addSkill = () => { if (skillInput.trim()) { setFormData({ ...formData, skills: [...formData.skills, skillInput.trim()] }); setSkillInput(''); } };
  const removeSkill = (skill: string) => setFormData({ ...formData, skills: formData.skills.filter(s => s !== skill) });
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSubmit(formData); };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: '#FFF', borderRadius: '28px', width: '90%', maxWidth: '600px', maxHeight: '90vh', overflow: 'auto', padding: '24px' }} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontSize: '24px', marginBottom: '20px' }}>{editingMember ? 'Edit Team Member' : 'Add Team Member'}</h2>
        <form onSubmit={handleSubmit}>
          <input type="text" placeholder="Full Name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required style={{ width: '100%', padding: '12px', marginBottom: '12px', border: '1px solid #E5E5EA', borderRadius: '12px' }} />
          <input type="email" placeholder="Email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} required style={{ width: '100%', padding: '12px', marginBottom: '12px', border: '1px solid #E5E5EA', borderRadius: '12px' }} />
          <input type="tel" placeholder="Phone" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} style={{ width: '100%', padding: '12px', marginBottom: '12px', border: '1px solid #E5E5EA', borderRadius: '12px' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })} style={{ padding: '12px', border: '1px solid #E5E5EA', borderRadius: '12px' }}>
              <option value="admin">Admin</option><option value="developer">Developer</option>
              <option value="designer">Designer</option><option value="manager">Manager</option><option value="intern">Intern</option>
            </select>
            <select value={formData.department} onChange={e => setFormData({ ...formData, department: e.target.value })} style={{ padding: '12px', border: '1px solid #E5E5EA', borderRadius: '12px' }}>
              <option value="development">Development</option><option value="design">Design</option>
              <option value="management">Management</option><option value="sales">Sales</option><option value="support">Support</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input type="text" placeholder="Add Skill" value={skillInput} onChange={e => setSkillInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addSkill())} style={{ flex: 1, padding: '12px', border: '1px solid #E5E5EA', borderRadius: '12px' }} />
            <button type="button" onClick={addSkill} style={{ padding: '12px 20px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '12px' }}>Add</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
            {formData.skills.map((s, i) => (<span key={i} style={{ padding: '4px 12px', background: '#007AFF10', borderRadius: '20px' }}>{s} <button type="button" onClick={() => removeSkill(s)} style={{ background: 'none', border: 'none', marginLeft: '8px', cursor: 'pointer' }}>×</button></span>))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <input type="number" placeholder="Experience (years)" value={formData.experience} onChange={e => setFormData({ ...formData, experience: parseInt(e.target.value) })} style={{ padding: '12px', border: '1px solid #E5E5EA', borderRadius: '12px' }} />
            <input type="date" value={formData.joinDate} onChange={e => setFormData({ ...formData, joinDate: e.target.value })} style={{ padding: '12px', border: '1px solid #E5E5EA', borderRadius: '12px' }} />
          </div>
          <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} style={{ width: '100%', padding: '12px', marginBottom: '12px', border: '1px solid #E5E5EA', borderRadius: '12px' }}>
            <option value="active">Active</option><option value="inactive">Inactive</option><option value="on-leave">On Leave</option>
          </select>
          <textarea placeholder="Bio" value={formData.bio} onChange={e => setFormData({ ...formData, bio: e.target.value })} rows={3} style={{ width: '100%', padding: '12px', marginBottom: '20px', border: '1px solid #E5E5EA', borderRadius: '12px' }} />
          <div style={{ display: 'flex', gap: '12px' }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '14px', background: '#F2F2F7', border: 'none', borderRadius: '14px' }}>Cancel</button>
            <button type="submit" style={{ flex: 1, padding: '14px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '14px' }}>{editingMember ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Main Page Component - DEFAULT EXPORT
export default function TeamPage() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Get token on client side only
  useEffect(() => {
    setToken(localStorage.getItem('token'));
  }, []);

  // Fetch team members
  const fetchTeamMembers = useCallback(async () => {
    const authToken = localStorage.getItem('token');
    if (!authToken) return;
    
    try {
      const response = await fetch('http://localhost:5000/api/team', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (response.ok) {
        const data = await response.json();
        setTeamMembers(data.data || []);
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

  // Create team member
  const createTeamMember = async (data: any) => {
    const authToken = localStorage.getItem('token');
    try {
      const response = await fetch('http://localhost:5000/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify(data)
      });
      if (response.ok) {
        await fetchTeamMembers();
        setIsModalOpen(false);
      }
    } catch (error) {
      console.error('Create error:', error);
    }
  };

  // Update team member
  const updateTeamMember = async (id: string, data: any) => {
    const authToken = localStorage.getItem('token');
    try {
      const response = await fetch(`http://localhost:5000/api/team/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify(data)
      });
      if (response.ok) {
        await fetchTeamMembers();
        setIsModalOpen(false);
        setEditingMember(null);
      }
    } catch (error) {
      console.error('Update error:', error);
    }
  };

  // Delete team member
  const deleteTeamMember = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    const authToken = localStorage.getItem('token');
    try {
      const response = await fetch(`http://localhost:5000/api/team/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (response.ok) {
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
    return <div style={{ padding: '40px', textAlign: 'center' }}>Please login to view team members</div>;
  }

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading team members...</div>;
  }

  return (
    <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '34px', fontWeight: '700', color: '#1C1C1E', marginBottom: '8px' }}>Team</h1>
          <p style={{ color: '#8E8E93' }}>Manage your team members</p>
        </div>
        <button onClick={() => { setEditingMember(null); setIsModalOpen(true); }} style={{
          padding: '12px 24px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          <Plus size={20} /> Add Member
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#FFF', borderRadius: '20px', padding: '20px', border: '1px solid #E5E5EA' }}>
          <Users size={24} color="#007AFF" /><div style={{ fontSize: '28px', fontWeight: '700', marginTop: '8px' }}>{stats.total}</div><div>Total Members</div>
        </div>
        <div style={{ background: '#FFF', borderRadius: '20px', padding: '20px', border: '1px solid #E5E5EA' }}>
          <UserCheck size={24} color="#34C759" /><div style={{ fontSize: '28px', fontWeight: '700', marginTop: '8px' }}>{stats.active}</div><div>Active</div>
        </div>
        <div style={{ background: '#FFF', borderRadius: '20px', padding: '20px', border: '1px solid #E5E5EA' }}>
          <Code size={24} color="#AF52DE" /><div style={{ fontSize: '28px', fontWeight: '700', marginTop: '8px' }}>{stats.developers}</div><div>Developers</div>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '24px', position: 'relative' }}>
        <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#8E8E93' }} />
        <input type="text" placeholder="Search by name or email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ width: '100%', padding: '12px 16px 12px 40px', border: '1px solid #E5E5EA', borderRadius: '14px', fontSize: '16px' }} />
      </div>

      {/* Team Grid */}
      {filteredMembers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', background: '#F9F9FB', borderRadius: '24px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>👥</div>
          <h3>No team members found</h3>
          <button onClick={() => setIsModalOpen(true)} style={{ marginTop: '16px', padding: '12px 24px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '14px', cursor: 'pointer' }}>Add your first member</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '24px' }}>
          {filteredMembers.map(member => (
            <TeamCard key={member._id} member={member} onEdit={(m) => { setEditingMember(m); setIsModalOpen(true); }} onDelete={deleteTeamMember} />
          ))}
        </div>
      )}

      {/* Modal */}
      <TeamModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingMember(null); }} onSubmit={handleSubmit} editingMember={editingMember} />
    </div>
  );
}