// PATH: websmith/app/client/projects/page.tsx
"use client";

import { useEffect, useState } from "react";
import { 
  Folder, 
  LayoutGrid, 
  List, 
  Calendar, 
  Clock, 
  Search,
  ChevronRight,
  Target
} from "lucide-react";
import API from "../../../core/services/apiService";
import { Project } from "../../projects/services/projectService";

export default function ClientProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState("");

  const fetchProjects = async () => {
    try {
      const response = await API.get("/projects");
      setProjects(response.data.data || []);
    } catch (err: any) {
      console.error("Failed to fetch projects:", err);
      setError(err.response?.data?.message || "Failed to load projects.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'pending': return { bg: '#FFF4E5', color: '#FF9500', text: 'Pending' };
      case 'in-progress': return { bg: '#E3F2FF', color: '#007AFF', text: 'In Progress' };
      case 'completed': return { bg: '#E8F5E9', color: '#34C759', text: 'Completed' };
      case 'on-hold': return { bg: '#FEF2F0', color: '#FF3B30', text: 'On Hold' };
      default: return { bg: '#F2F2F7', color: '#8E8E93', text: status };
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}></div>
          <p>Loading your projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>My Projects</h1>
          <p style={styles.subtitle}>View and track all your active projects</p>
        </div>
        
        <div style={styles.headerActions}>
          <div style={styles.searchBox}>
            <Search size={16} color="#8E8E93" />
            <input 
              type="text" 
              placeholder="Search projects..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={styles.searchInput}
            />
          </div>
          
          <div style={styles.viewToggle}>
            <button 
              onClick={() => setViewMode('grid')}
              style={{ ...styles.toggleBtn, ...(viewMode === 'grid' ? styles.toggleBtnActive : {}) }}
            >
              <LayoutGrid size={18} />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              style={{ ...styles.toggleBtn, ...(viewMode === 'list' ? styles.toggleBtnActive : {}) }}
            >
              <List size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Projects Display */}
      {error ? (
        <div style={styles.errorState}>
          <p style={{ color: '#FF3B30', fontWeight: 500 }}>{error}</p>
          <button onClick={fetchProjects} style={styles.retryBtn}>Retry</button>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div style={styles.emptyState}>
          <Folder size={48} color="#C6C6C8" />
          <h3>No projects found</h3>
          <p>You don't have any projects assigned yet.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div style={styles.grid}>
          {filteredProjects.map(project => (
            <div key={project._id} style={styles.card} className="project-card">
              <div style={styles.cardHeader}>
                <div style={styles.iconContainer}>
                  <Folder size={24} color="#007AFF" />
                </div>
                {(() => {
                  const status = getStatusStyle(project.status);
                  return (
                    <span style={{ ...styles.statusBadge, backgroundColor: status.bg, color: status.color }}>
                      {status.text}
                    </span>
                  );
                })()}
              </div>
              
              <h3 style={styles.projectName}>{project.name}</h3>
              <p style={styles.projectDesc}>{project.description}</p>
              
              <div style={styles.cardFooter}>
                <div style={styles.dateInfo}>
                  <Calendar size={14} color="#8E8E93" />
                  <span>Start: {formatDate(project.startDate)}</span>
                </div>
                {project.expectedCompletionDate && (
                  <div style={styles.deliveryDate}>
                    <Target size={14} color="#007AFF" />
                    <span style={{ color: '#007AFF', fontWeight: 500 }}>
                      Delivery: {formatDate(project.expectedCompletionDate)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={styles.list}>
          <div style={styles.listHeader}>
            <div style={styles.colName}>Project Name</div>
            <div style={styles.colStatus}>Status</div>
            <div style={styles.colStart}>Start Date</div>
            <div style={styles.colDelivery}>Est. Delivery</div>
          </div>
          {filteredProjects.map(project => (
            <div key={project._id} style={styles.listItem} className="list-item">
              <div style={styles.colName}>
                <div style={styles.listIconWrap}>
                   <Folder size={18} color="#007AFF" />
                </div>
                <div style={styles.listNameWrap}>
                   <p style={styles.listProjectName}>{project.name}</p>
                   <p style={styles.listProjectDesc}>{project.description.substring(0, 50)}...</p>
                </div>
              </div>
              <div style={styles.colStatus}>
                {(() => {
                  const status = getStatusStyle(project.status);
                  return (
                    <span style={{ ...styles.statusBadge, backgroundColor: status.bg, color: status.color }}>
                      {status.text}
                    </span>
                  );
                })()}
              </div>
              <div style={styles.colStart}>{formatDate(project.startDate)}</div>
              <div style={styles.colDelivery}>
                 {project.expectedCompletionDate ? (
                   <span style={{ color: '#007AFF', fontWeight: 500 }}>
                     {formatDate(project.expectedCompletionDate)}
                   </span>
                 ) : '-'}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .project-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .project-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0,0,0,0.08);
          border-color: #007AFF33 !important;
        }
        .list-item {
          transition: all 0.2s ease;
        }
        .list-item:hover {
          background-color: #FAFBFF !important;
          transform: translateX(4px);
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const styles: any = {
  container: { padding: '8px 4px' },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '32px',
  },
  title: { fontSize: '34px', fontWeight: 600, color: '#1C1C1E', marginBottom: '8px' },
  subtitle: { fontSize: '15px', color: '#8E8E93' },
  headerActions: { display: 'flex', gap: '16px', alignItems: 'center' },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: '#FFFFFF',
    border: '1px solid #E5E5EA',
    borderRadius: '10px',
    padding: '8px 12px',
    width: '240px',
  },
  searchInput: { border: 'none', outline: 'none', fontSize: '14px', flex: 1 },
  viewToggle: {
    display: 'flex',
    backgroundColor: '#F2F2F7',
    padding: '4px',
    borderRadius: '10px',
  },
  toggleBtn: {
    padding: '6px 12px',
    border: 'none',
    backgroundColor: 'transparent',
    borderRadius: '8px',
    cursor: 'pointer',
    color: '#8E8E93',
    transition: 'all 0.2s ease',
  },
  toggleBtnActive: { backgroundColor: '#FFFFFF', color: '#007AFF', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '24px',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: '20px',
    padding: '24px',
    border: '1px solid #E5E5EA',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  iconContainer: {
    width: '48px',
    height: '48px',
    backgroundColor: '#F2F2F7',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectName: { fontSize: '18px', fontWeight: 600, color: '#1C1C1E', margin: 0 },
  projectDesc: { fontSize: '14px', color: '#8E8E93', lineHeight: 1.5, margin: 0 },
  cardFooter: {
    marginTop: '8px',
    paddingTop: '16px',
    borderTop: '1px solid #F2F2F7',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  dateInfo: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#8E8E93' },
  deliveryDate: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' },
  statusBadge: {
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: 600,
  },
  list: { backgroundColor: '#FFFFFF', borderRadius: '20px', border: '1px solid #E5E5EA', overflow: 'hidden' },
  listHeader: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr 1fr 1fr',
    padding: '16px 24px',
    backgroundColor: '#FAFAFB',
    borderBottom: '1px solid #E5E5EA',
    fontSize: '13px',
    fontWeight: 600,
    color: '#8E8E93',
  },
  listItem: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr 1fr 1fr',
    padding: '20px 24px',
    alignItems: 'center',
    borderBottom: '1px solid #F2F2F7',
  },
  colName: { display: 'flex', alignItems: 'center', gap: '16px' },
  colStatus: {},
  colStart: { fontSize: '14px', color: '#636366' },
  colDelivery: { fontSize: '14px' },
  listIconWrap: {
    width: '36px',
    height: '36px',
    backgroundColor: '#F2F2F7',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  listNameWrap: { overflow: 'hidden' },
  listProjectName: { fontSize: '15px', fontWeight: 600, color: '#1C1C1E', margin: 0, marginBottom: '2px' },
  listProjectDesc: { fontSize: '12px', color: '#8E8E93', margin: 0, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' },
  loadingContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '100px' },
  spinner: { width: '32px', height: '32px', border: '3px solid #E5E5EA', borderTopColor: '#007AFF', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  emptyState: { textAlign: 'center', padding: '100px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' },
  errorState: { textAlign: 'center', padding: '60px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' },
  retryBtn: { padding: '10px 24px', backgroundColor: '#007AFF', color: '#FFFFFF', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' },
};
