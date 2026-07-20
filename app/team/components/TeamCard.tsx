// PATH: C:\websmith\app\team\components\TeamCard.tsx
'use client';

import React from 'react';
import { TeamMember } from '../services/teamService';
import { Users, Mail, Phone, Briefcase, Calendar, Award, Edit2, Trash2 } from 'lucide-react';
import Badge from '../../../components/ui/Badge';

interface TeamCardProps {
  member: TeamMember;
  onEdit: (member: TeamMember) => void;
  onDelete: (id: string) => void;
}

const getRoleColor = (role: string): string => {
  const colors: Record<string, string> = {
    admin: '#FF3B30',
    developer: '#007AFF',
    designer: '#AF52DE',
    manager: '#FF9500',
    intern: '#34C759',
  };
  return colors[role] || '#8E8E93';
};

const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    active: '#34C759',
    inactive: '#8E8E93',
    'on-leave': '#FF9500',
  };
  return colors[status] || '#8E8E93';
};

const getDepartmentIcon = (department: string) => {
  const icons: Record<string, React.ReactNode> = {
    development: '💻',
    design: '🎨',
    management: '📊',
    sales: '📈',
    support: '🎧',
  };
  return icons[department] || '👤';
};

const TeamCard: React.FC<TeamCardProps> = ({ member, onEdit, onDelete }) => {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div
      style={{
        background: '#FFFFFF',
        borderRadius: '20px',
        padding: '20px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
        transition: 'all 0.3s ease',
        cursor: 'pointer',
        border: '1px solid #E5E5EA',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 12px 24px rgba(0, 0, 0, 0.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.04)';
      }}
    >
      {/* Header with Avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
        <div
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '30px',
            background: `linear-gradient(135deg, ${getRoleColor(member.role)}20, ${getRoleColor(member.role)}40)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            fontWeight: '600',
            color: getRoleColor(member.role),
          }}
        >
          {member.name.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1C1C1E', marginBottom: '4px' }}>
            {member.name}
          </h3>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Badge text={member.role} color={getRoleColor(member.role)} />
            <Badge text={member.status} color={getStatusColor(member.status)} />
          </div>
        </div>
      </div>

      {/* Details */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <Mail size={16} color="#8E8E93" />
          <span style={{ fontSize: '14px', color: '#3A3A3C' }}>{member.email}</span>
        </div>
        {member.phone && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <Phone size={16} color="#8E8E93" />
            <span style={{ fontSize: '14px', color: '#3A3A3C' }}>{member.phone}</span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <Briefcase size={16} color="#8E8E93" />
          <span style={{ fontSize: '14px', color: '#3A3A3C' }}>
            {getDepartmentIcon(member.department)} {member.department} • {member.experience} years
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Calendar size={16} color="#8E8E93" />
          <span style={{ fontSize: '14px', color: '#3A3A3C' }}>Joined {formatDate(member.joinDate)}</span>
        </div>
      </div>

      {/* Skills */}
      {member.skills && member.skills.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Award size={14} color="#8E8E93" />
            <span style={{ fontSize: '12px', fontWeight: '500', color: '#8E8E93' }}>SKILLS</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {member.skills.slice(0, 3).map((skill, index) => (
              <span
                key={index}
                style={{
                  padding: '4px 10px',
                  background: '#F2F2F7',
                  borderRadius: '12px',
                  fontSize: '12px',
                  color: '#3A3A3C',
                }}
              >
                {skill}
              </span>
            ))}
            {member.skills.length > 3 && (
              <span style={{ fontSize: '12px', color: '#8E8E93' }}>+{member.skills.length - 3}</span>
            )}
          </div>
        </div>
      )}

      {/* Bio */}
      {member.bio && (
        <p style={{ fontSize: '13px', color: '#6C6C70', marginBottom: '16px', lineHeight: '1.4' }}>
          {member.bio.length > 100 ? `${member.bio.substring(0, 100)}...` : member.bio}
        </p>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid #E5E5EA', paddingTop: '16px' }}>
        <button
          onClick={() => onEdit(member)}
          style={{
            flex: 1,
            padding: '10px',
            background: '#007AFF',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#0051D5';
            e.currentTarget.style.transform = 'scale(1.02)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#007AFF';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <Edit2 size={14} /> Edit
        </button>
        <button
          onClick={() => onDelete(member._id)}
          style={{
            flex: 1,
            padding: '10px',
            background: '#FF3B30',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#D70015';
            e.currentTarget.style.transform = 'scale(1.02)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#FF3B30';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <Trash2 size={14} /> Delete
        </button>
      </div>
    </div>
  );
};

export default TeamCard;