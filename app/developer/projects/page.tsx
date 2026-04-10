// PATH: C:\websmith\app\developer\projects\page.tsx
"use client";

import { useEffect, useState } from "react";
import { Project, getProjects, updateProjectStatus } from "../../projects/services/projectService";
import { Folder, Clock, CheckCircle2, AlertCircle, ChevronRight } from "lucide-react";

export default function DeveloperProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await getProjects();
      setProjects(data);
    } catch (error) {
      console.error("Developer projects error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleStatusChange = async (id: string, status: string) => {
    await updateProjectStatus(id, { status, note: `Developer updated status to ${status}` });
    await loadProjects();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 size={20} color="#34C759" />;
      case 'in-progress': return <Clock size={20} color="#007AFF" />;
      case 'on-hold': return <AlertCircle size={20} color="#FF9500" />;
      default: return <Clock size={20} color="var(--text-secondary)" />;
    }
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p style={{ color: 'var(--text-secondary)' }}>Syncing your workspace...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Projects</h1>
        <p style={styles.subtitle}>Track and update the delivery status of your assigned development work</p>
      </div>

      {projects.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}><Folder size={48} color="var(--border-color)" /></div>
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>No assignments yet</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Your assigned projects will appear here once an admin maps them to you.</p>
        </div>
      ) : (
        <div style={styles.grid}>
          {projects.map((project) => (
            <div key={project._id} style={styles.card} className="developer-project-card">
              <div style={styles.cardHeader}>
                <div style={styles.iconWrapper}>
                  <Folder size={24} color="#007AFF" />
                </div>
                {getStatusIcon(project.status)}
              </div>
              
              <h3 style={styles.cardTitle}>{project.name}</h3>
              <p style={styles.cardText}>{project.description || "No description provided for this project."}</p>
              
              <div style={styles.detailsBox}>
                <div style={styles.row}>
                  <span style={styles.label}>Current Phase</span>
                  <span style={{ ...styles.value, color: project.status === 'completed' ? '#34C759' : '#007AFF' }}>
                    {project.status.replace('-', ' ')}
                  </span>
                </div>
                <div style={styles.row}>
                  <span style={styles.label}>Progress Tracking</span>
                  <span style={styles.value}>{project.progress || 0}%</span>
                </div>
              </div>

              <div style={styles.actionSection}>
                <label style={styles.selectLabel}>Update Status</label>
                <div style={styles.selectWrapper}>
                  <select 
                    value={project.status} 
                    onChange={(e) => handleStatusChange(project._id!, e.target.value)} 
                    style={styles.select}
                  >
                    <option value="pending">Pending</option>
                    <option value="in-progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="on-hold">On Hold</option>
                  </select>
                  <ChevronRight size={16} style={styles.selectIcon} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .developer-project-card { transition: all 0.3s ease; }
        .developer-project-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0,0,0,0.08) !important; border-color: #007AFF55 !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const styles: any = {
  container: { 
    padding: "8px 4px",
    backgroundColor: 'var(--bg-primary)',
    minHeight: '100vh',
    color: 'var(--text-primary)'
  },
  header: { marginBottom: "40px" },
  title: { 
    fontSize: "34px", 
    fontWeight: 700, 
    color: "var(--text-primary)", 
    margin: 0, 
    marginBottom: "8px", 
    letterSpacing: "-1px" 
  },
  subtitle: { fontSize: "15px", color: "var(--text-secondary)", margin: 0 },
  grid: { 
    display: "grid", 
    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", 
    gap: "24px" 
  },
  card: { 
    backgroundColor: "var(--bg-primary)", 
    borderRadius: "24px", 
    border: "1.5px solid var(--border-color)", 
    padding: "28px",
    boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
    display: 'flex',
    flexDirection: 'column'
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '20px'
  },
  iconWrapper: {
    width: '48px',
    height: '48px',
    borderRadius: '14px',
    backgroundColor: 'var(--bg-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid var(--border-color)'
  },
  cardTitle: { 
    fontSize: "20px", 
    fontWeight: 700, 
    color: "var(--text-primary)", 
    margin: 0, 
    marginBottom: "10px",
    letterSpacing: '-0.5px'
  },
  cardText: { 
    fontSize: "14px", 
    color: "var(--text-secondary)", 
    margin: 0, 
    marginBottom: "24px", 
    lineHeight: 1.6,
    flex: 1
  },
  detailsBox: {
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: '16px',
    padding: '16px',
    marginBottom: '24px',
    border: '1px solid var(--border-color)'
  },
  row: { display: "flex", justifyContent: "space-between", marginBottom: "10px" },
  label: { fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)" },
  value: { fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", textTransform: "capitalize" },
  actionSection: {
    marginTop: 'auto'
  },
  selectLabel: {
    display: 'block',
    fontSize: '12px',
    fontWeight: 800,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '8px'
  },
  selectWrapper: {
    position: 'relative'
  },
  select: { 
    width: "100%", 
    padding: "14px 16px", 
    border: "1.5px solid var(--border-color)", 
    borderRadius: "14px", 
    fontSize: "14px", 
    fontWeight: 600,
    fontFamily: "inherit", 
    backgroundColor: "var(--bg-primary)",
    color: 'var(--text-primary)',
    appearance: 'none',
    outline: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  selectIcon: {
    position: 'absolute',
    right: '16px',
    top: '50%',
    transform: 'translateY(-50%) rotate(90deg)',
    color: 'var(--text-secondary)',
    pointerEvents: 'none'
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '100px',
    gap: '20px'
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid var(--border-color)',
    borderTopColor: '#007AFF',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite'
  },
  emptyState: {
    textAlign: 'center',
    padding: '100px 40px',
    background: 'var(--bg-secondary)',
    borderRadius: '32px',
    border: '1.5px dashed var(--border-color)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px'
  },
  emptyIcon: {
    width: '80px',
    height: '80px',
    borderRadius: '24px',
    backgroundColor: 'var(--bg-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid var(--border-color)'
  }
};
