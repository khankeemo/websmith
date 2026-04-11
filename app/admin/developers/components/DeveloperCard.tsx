"use client";

import { RoleUser } from "../../../../core/services/userService";
import { Edit, Trash2, UserCheck, Eye } from "lucide-react";

interface DeveloperCardProps {
  developer: RoleUser;
  viewMode: "grid" | "list";
  onEdit: (developer: RoleUser) => void;
  onDelete: (id: string) => void;
  onTogglePublish: (developer: RoleUser) => void;
}

export default function DeveloperCard({ developer, viewMode, onEdit, onDelete, onTogglePublish }: DeveloperCardProps) {
  const getStatusColor = (status?: string) => {
    const colors: Record<string, string> = {
      active: "#34C759",
      inactive: "#8E8E93",
      "on-leave": "#FF9500",
    };
    return colors[status || "inactive"] || "#8E8E93";
  };

  if (viewMode === "list") {
    return (
      <div style={styles.listRow}>
        <div style={styles.listInfo}>
          <div style={styles.avatar}>{developer.name.charAt(0).toUpperCase()}</div>
          <div>
            <strong>{developer.name}</strong>
            <p style={styles.listMeta}>
              {developer.customId} • {developer.email}
            </p>
          </div>
        </div>
        <div style={styles.listActions}>
          <span style={{ ...styles.statusBadge, backgroundColor: `${getStatusColor(developer.status)}20`, color: getStatusColor(developer.status) }}>
            {developer.status}
          </span>
          <button onClick={() => onTogglePublish(developer)} style={{ ...styles.iconBtn, color: developer.published ? "#007AFF" : "#8E8E93" }}>
            <Eye size={18} />
          </button>
          <button onClick={() => onEdit(developer)} style={{ ...styles.iconBtn, color: "#007AFF" }}>
            <Edit size={18} />
          </button>
          <button onClick={() => onDelete(developer._id)} style={{ ...styles.iconBtn, color: "#FF3B30" }}>
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <div style={styles.avatarLarge}>{developer.name.charAt(0).toUpperCase()}</div>
        <div style={styles.badges}>
          <span style={{ ...styles.statusBadge, backgroundColor: `${getStatusColor(developer.status)}20`, color: getStatusColor(developer.status) }}>
            {developer.status}
          </span>
          {developer.published && (
            <span style={{ ...styles.statusBadge, backgroundColor: "#E3F2FF", color: "#007AFF" }}>
              Published
            </span>
          )}
        </div>
      </div>

      <div style={styles.cardBody}>
        <h3 style={styles.name}>{developer.name}</h3>
        <p style={styles.customId}>{developer.customId}</p>
        <p style={styles.email}>{developer.email}</p>
        
        {developer.headline && <p style={styles.headline}>{developer.headline}</p>}
        
        {developer.skills && developer.skills.length > 0 && (
          <div style={styles.skills}>
            {developer.skills.slice(0, 3).map((skill, index) => (
              <span key={index} style={styles.skill}>{skill}</span>
            ))}
            {developer.skills.length > 3 && (
              <span style={styles.moreSkill}>+{developer.skills.length - 3}</span>
            )}
          </div>
        )}

        <div style={styles.meta}>
          <span>📅 {developer.experienceYears || 0} years exp</span>
          {developer.joinedAt && <span>• Joined {new Date(developer.joinedAt).toLocaleDateString()}</span>}
        </div>
      </div>

      <div style={styles.cardActions}>
        <button onClick={() => onTogglePublish(developer)} style={developer.published ? styles.primaryBtn : styles.secondaryBtn}>
          <Eye size={16} />
          {developer.published ? "Unpublish" : "Publish"}
        </button>
        <button onClick={() => onEdit(developer)} style={styles.secondaryBtn}>
          <Edit size={16} />
          Edit
        </button>
        <button onClick={() => onDelete(developer._id)} style={styles.dangerBtn}>
          <Trash2 size={16} />
          Delete
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, any> = {
  card: { background: "#fff", border: "1px solid #E5E5EA", borderRadius: "20px", overflow: "hidden" },
  cardHeader: { padding: "20px", background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  avatarLarge: { width: "64px", height: "64px", borderRadius: "32px", background: "rgba(255,255,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", fontWeight: 700, color: "#fff" },
  badges: { display: "flex", gap: "8px" },
  statusBadge: { padding: "4px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: 600, textTransform: "capitalize" },
  cardBody: { padding: "20px" },
  name: { margin: 0, fontSize: "20px", fontWeight: 600, color: "#1C1C1E" },
  customId: { margin: "4px 0", fontSize: "13px", color: "#007AFF", fontWeight: 600 },
  email: { margin: "4px 0 12px", fontSize: "14px", color: "#8E8E93" },
  headline: { margin: "12px 0", fontSize: "14px", color: "#3A3A3C", fontStyle: "italic" },
  skills: { display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "12px" },
  skill: { padding: "4px 10px", background: "#F2F2F7", borderRadius: "12px", fontSize: "12px", color: "#3A3A3C" },
  moreSkill: { padding: "4px 10px", background: "#E5E5EA", borderRadius: "12px", fontSize: "12px", color: "#8E8E93" },
  meta: { fontSize: "13px", color: "#8E8E93" },
  cardActions: { display: "flex", gap: "8px", padding: "16px 20px", borderTop: "1px solid #E5E5EA" },
  primaryBtn: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "10px", background: "#007AFF", color: "#fff", border: "none", borderRadius: "10px", fontSize: "13px", fontWeight: 600, cursor: "pointer" },
  secondaryBtn: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "10px", background: "#F2F2F7", color: "#1C1C1E", border: "none", borderRadius: "10px", fontSize: "13px", fontWeight: 600, cursor: "pointer" },
  dangerBtn: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "10px", background: "#FF3B30", color: "#fff", border: "none", borderRadius: "10px", fontSize: "13px", fontWeight: 600, cursor: "pointer" },
  listRow: { display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: "16px", background: "#fff", border: "1px solid #E5E5EA", borderRadius: "16px", padding: "16px 20px" },
  listInfo: { display: "flex", alignItems: "center", gap: "16px" },
  avatar: { width: "48px", height: "48px", borderRadius: "24px", background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", fontWeight: 700, color: "#fff" },
  listMeta: { margin: "4px 0 0", fontSize: "13px", color: "#8E8E93" },
  listActions: { display: "flex", alignItems: "center", gap: "12px" },
  iconBtn: { background: "none", border: "none", cursor: "pointer", padding: "6px" },
};
