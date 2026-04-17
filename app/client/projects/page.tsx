// PATH: websmith/app/client/projects/page.tsx
"use client";

import { useEffect, useState } from "react";
import { 
  Folder, 
  LayoutGrid, 
  List,
  Columns,
  Calendar,
  Search,
  Target,
  Eye,
  FileText,
  X,
  Send,
  TrendingUp
} from "lucide-react";
import API from "../../../core/services/apiService";
import { getProjectFeedback, Project, submitProjectFeedback } from "../../projects/services/projectService";
import { getStoredUser } from "../../../lib/auth";

export default function ClientProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'kanban'>('grid');
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'feedback'>('details');
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [projectFeedback, setProjectFeedback] = useState<any[]>([]);
  const [feedbackError, setFeedbackError] = useState("");

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

  const fetchProjectDetails = async (projectId: string) => {
    try {
      const feedback = await getProjectFeedback(projectId);
      setProjectFeedback(feedback);
    } catch (err) {
      console.error("Failed to fetch project details:", err);
      setProjectFeedback([]);
    }
  };

  const isProjectCompleted = (project?: Project | null) => project?.status === "completed";

  const handleSendFeedback = async () => {
    if (!selectedProject || !feedbackText.trim()) return;
    if (!isProjectCompleted(selectedProject)) return;
    if (projectFeedback.length > 0) {
      setFeedbackError("Feedback has already been submitted for this project.");
      return;
    }
    try {
      setFeedbackError("");
      const currentUser = getStoredUser();
      const feedback = await submitProjectFeedback(selectedProject._id!, {
        rating: feedbackRating,
        comment: feedbackText,
        clientName: currentUser?.name || "Client",
      });
      setFeedbackText("");
      setFeedbackRating(5);
      setProjectFeedback(feedback);
    } catch (err: any) {
      console.error("Failed to send feedback:", err);
      setFeedbackError(typeof err === "string" ? err : "Failed to submit feedback");
    }
  };

  const handleProjectClick = async (project: Project) => {
    setSelectedProject(project);
    setActiveTab('details');
    setFeedbackError("");
    if (isProjectCompleted(project)) {
      await fetchProjectDetails(project._id!);
    } else {
      setProjectFeedback([]);
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
      case 'pending': return { bg: 'rgba(255, 149, 0, 0.1)', color: '#FF9500', text: 'Pending' };
      case 'in-progress': return { bg: 'rgba(0, 122, 255, 0.1)', color: '#007AFF', text: 'In Progress' };
      case 'completed': return { bg: 'rgba(52, 199, 89, 0.1)', color: '#34C759', text: 'Completed' };
      case 'on-hold': return { bg: 'rgba(255, 59, 48, 0.1)', color: '#FF3B30', text: 'On Hold' };
      default: return { bg: 'var(--bg-secondary)', color: 'var(--text-secondary)', text: status };
    }
  };

  if (loading) {
    return (
      <div style={styles.container} className="wsd-page">
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}></div>
          <p style={{ color: "var(--text-secondary)" }}>Loading your projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container} className="wsd-page">
      {/* Header */}
      <div style={styles.header} className="client-projects-header">
        <div>
          <h1 style={styles.title}>My Projects</h1>
          <p style={styles.subtitle}>View and track all your active projects</p>
        </div>
        
        <div style={styles.headerActions}>
          <div style={styles.searchBox}>
            <Search size={16} color="var(--text-secondary)" />
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
              style={{ ...styles.viewToggleBtn, ...(viewMode === 'grid' ? styles.viewToggleBtnActive : {}) }}
            >
              <LayoutGrid size={18} />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              style={{ ...styles.viewToggleBtn, ...(viewMode === 'list' ? styles.viewToggleBtnActive : {}) }}
            >
              <List size={18} />
            </button>
            <button 
              onClick={() => setViewMode('kanban')}
              style={{ ...styles.viewToggleBtn, ...(viewMode === 'kanban' ? styles.viewToggleBtnActive : {}) }}
            >
              <Columns size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Projects Display */}
      {error ? (
        <div style={styles.errorState}>
          <p style={{ color: '#FF3B30', fontWeight: 600 }}>{error}</p>
          <button onClick={fetchProjects} style={styles.retryBtn}>Retry</button>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div style={styles.emptyState}>
          <Folder size={64} color="var(--border-color)" />
          <h3 style={{ color: "var(--text-primary)" }}>No projects found</h3>
          <p style={{ color: "var(--text-secondary)" }}>You don't have any projects assigned yet.</p>
        </div>
      ) : viewMode === 'kanban' ? (
        <div style={styles.kanban}>
          {["pending", "in-progress", "completed", "on-hold"].map((status) => {
            const statusProjects = filteredProjects.filter((p) => p.status === status);
            const statusStyle = getStatusStyle(status);
            return (
              <div key={status} style={styles.kanbanColumn}>
                <div style={styles.kanbanHeader}>
                  <h3 style={{ ...styles.kanbanTitle, color: statusStyle.color }}>
                    {statusStyle.text}
                  </h3>
                  <span style={styles.kanbanCount}>{statusProjects.length}</span>
                </div>
                <div style={styles.kanbanCards}>
                  {statusProjects.map((project) => (
                    <div key={project._id} style={styles.kanbanCard}>
                      <div style={styles.kanbanCardHeader}>
                        <Folder size={16} color="#007AFF" />
                        <strong style={styles.kanbanCardName}>{project.name}</strong>
                      </div>
                      <p style={styles.kanbanCardDesc}>{project.description}</p>
                      {project.progress !== undefined && (
                        <div style={styles.kanbanProgress}>
                          <div style={styles.progressHeader}>
                            <span style={styles.progressLabel}>Progress</span>
                            <span style={styles.progressValue}>{project.progress}%</span>
                          </div>
                          <div style={styles.progressBar}>
                            <div 
                              style={{ 
                                ...styles.progressFill, 
                                width: `${project.progress}%`,
                                backgroundColor: project.progress >= 75 ? '#34C759' : project.progress >= 50 ? '#007AFF' : '#FF9500'
                              }}
                            ></div>
                          </div>
                        </div>
                      )}
                      <div style={styles.kanbanCardFooter}>
                        <Calendar size={12} color="var(--text-secondary)" />
                        <span style={styles.kanbanCardDate}>{formatDate(project.expectedCompletionDate)}</span>
                        <button 
                          onClick={() => handleProjectClick(project)} 
                          style={styles.kanbanViewBtn}
                        >
                          <Eye size={12} />
                          View
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
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
                  <Calendar size={14} color="var(--text-secondary)" />
                  <span>Start: {formatDate(project.startDate)}</span>
                </div>
                {project.expectedCompletionDate && (
                  <div style={styles.deliveryDate}>
                    <Target size={14} color="#007AFF" />
                    <span style={{ color: '#007AFF', fontWeight: 600 }}>
                      Delivery: {formatDate(project.expectedCompletionDate)}
                    </span>
                  </div>
                )}
                <button onClick={() => handleProjectClick(project)} style={styles.viewProjectBtn}>
                  <Eye size={14} />
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={styles.list}>
          <div style={styles.listHeader} className="client-projects-list-header">
            <div style={styles.colName}>Project Name</div>
            <div style={styles.colStatus}>Status</div>
            <div style={styles.colStart}>Start Date</div>
            <div style={styles.colDelivery}>Est. Delivery</div>
          </div>
          {filteredProjects.map(project => (
            <div key={project._id} style={styles.listItem} className="list-item client-projects-list-item">
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
                   <span style={{ color: '#007AFF', fontWeight: 600 }}>
                     {formatDate(project.expectedCompletionDate)}
                   </span>
                 ) : '-'}
              </div>
              <div style={styles.colActions}>
                <button onClick={() => handleProjectClick(project)} style={styles.viewProjectBtn}>
                  <Eye size={14} />
                  View
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Project Detail Modal */}
      {selectedProject && (
        <div style={styles.modal} onClick={() => setSelectedProject(null)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>{selectedProject.name}</h2>
                <p style={styles.modalSubtitle}>{selectedProject.description}</p>
              </div>
              <button onClick={() => setSelectedProject(null)} style={styles.closeBtn}>
                <X size={20} />
              </button>
            </div>
            
            {/* Tab Navigation */}
            <div style={styles.tabNav}>
              <button 
                onClick={() => setActiveTab('details')}
                style={{
                  ...styles.tabBtn,
                  ...(activeTab === 'details' ? styles.tabBtnActive : {})
                }}
              >
                <TrendingUp size={14} />
                Details
              </button>
              {isProjectCompleted(selectedProject) && (
                <button
                  onClick={() => setActiveTab('feedback')}
                  style={{
                    ...styles.tabBtn,
                    ...(activeTab === 'feedback' ? styles.tabBtnActive : {})
                  }}
                >
                  <FileText size={14} />
                  Feedback ({projectFeedback.length})
                </button>
              )}
            </div>

            {/* Tab Content */}
            <div style={styles.modalBody}>
              {activeTab === 'details' && (
                <div style={styles.detailsTab}>
                  <div style={styles.detailGrid}>
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>Status:</span>
                      <span style={{
                        ...styles.detailValue,
                        ...(() => {
                          const status = getStatusStyle(selectedProject.status);
                          return { backgroundColor: status.bg, color: status.color };
                        })()
                      }}>
                        {getStatusStyle(selectedProject.status).text}
                      </span>
                    </div>
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>Progress:</span>
                      <span style={styles.detailValue}>{selectedProject.progress || 0}%</span>
                    </div>
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>Start Date:</span>
                      <span style={styles.detailValue}>{formatDate(selectedProject.startDate)}</span>
                    </div>
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>Expected Delivery:</span>
                      <span style={styles.detailValue}>{formatDate(selectedProject.expectedCompletionDate)}</span>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div style={styles.progressSection}>
                    <h3 style={styles.sectionTitle}>Overall Progress</h3>
                    <div style={styles.progressHeader}>
                      <span style={styles.progressLabel}>{selectedProject.progress || 0}% Complete</span>
                    </div>
                    <div style={styles.progressBar}>
                      <div 
                        style={{ 
                          ...styles.progressFill, 
                          width: `${selectedProject.progress || 0}%`,
                          backgroundColor: (selectedProject.progress || 0) >= 75 ? '#34C759' : (selectedProject.progress || 0) >= 50 ? '#007AFF' : '#FF9500'
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'feedback' && isProjectCompleted(selectedProject) && (
                <div style={styles.feedbackTab}>
                  <div style={styles.feedbackList}>
                    {projectFeedback.map((fb: any, idx: number) => (
                      <div key={idx} style={styles.feedbackItem}>
                        <div style={styles.feedbackHeader}>
                          <strong style={styles.feedbackAuthor}>{fb.clientName || fb.author || 'Client'}</strong>
                          <span style={styles.feedbackTime}>
                            {new Date(fb.timestamp || fb.createdAt).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <p style={styles.feedbackText}>{fb.comment || fb.feedback}</p>
                        {typeof fb.rating === 'number' && <p style={styles.feedbackRating}>Rating: {fb.rating}/5</p>}
                      </div>
                    ))}
                    {projectFeedback.length === 0 && (
                      <p style={styles.emptyMessage}>No feedback yet</p>
                    )}
                  </div>
                  {projectFeedback.length === 0 ? (
                    <div style={styles.feedbackInputWrap}>
                      {feedbackError && <p style={styles.feedbackError}>{feedbackError}</p>}
                      <select value={feedbackRating} onChange={(e) => setFeedbackRating(Number(e.target.value))} style={styles.ratingSelect}>
                        {[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} Stars</option>)}
                      </select>
                      <textarea 
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        placeholder="Provide feedback..."
                        style={styles.feedbackTextarea}
                        rows={3}
                      />
                      <button onClick={handleSendFeedback} style={styles.sendBtn} disabled={!feedbackText.trim()}>
                        <Send size={14} />
                        Send Feedback
                      </button>
                    </div>
                  ) : (
                    <p style={styles.feedbackSubmitted}>Feedback has already been submitted for this project.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .project-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .project-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0,0,0,0.12);
          border-color: #007AFF55 !important;
        }
        .list-item {
          transition: all 0.2s ease;
        }
        .list-item:hover {
          background-color: var(--bg-secondary) !important;
          transform: translateX(4px);
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 900px) {
          .client-projects-header {
            flex-direction: column !important;
            gap: 16px;
          }
        }
        @media (max-width: 768px) {
          .client-projects-list-header {
            display: none !important;
          }
          .client-projects-list-item {
            grid-template-columns: 1fr !important;
            gap: 12px;
          }
        }
      `}</style>
    </div>
  );
}

const styles: any = {
  container: { 
    padding: 0,
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    minHeight: '100vh',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '32px',
  },
  title: { fontSize: '34px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: "-1px" },
  subtitle: { fontSize: '15px', color: 'var(--text-secondary)' },
  headerActions: { display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', width: '100%' },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: 'var(--bg-primary)',
    border: '1.5px solid var(--border-color)',
    borderRadius: '12px',
    padding: '8px 14px',
    width: '240px',
    maxWidth: '100%',
  },
  searchInput: { border: 'none', outline: 'none', fontSize: '14px', flex: 1, backgroundColor: 'transparent', color: 'var(--text-primary)' },
  viewToggle: {
    display: 'flex',
    backgroundColor: 'var(--bg-secondary)',
    padding: '4px',
    borderRadius: '12px',
    border: '1px solid var(--border-color)',
  },
  toggleBtn: {
    padding: '6px 12px',
    border: 'none',
    backgroundColor: 'transparent',
    borderRadius: '10px',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    transition: 'all 0.2s ease',
  },
  viewToggleBtn: {
    padding: '6px 12px',
    border: 'none',
    backgroundColor: 'transparent',
    borderRadius: '10px',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewToggleBtnActive: { backgroundColor: 'var(--bg-primary)', color: '#007AFF', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '24px',
  },
  card: {
    backgroundColor: 'var(--bg-primary)',
    borderRadius: '20px',
    padding: '24px',
    border: '1.5px solid var(--border-color)',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
  },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
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
  projectName: { fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 },
  projectDesc: { fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 },
  cardFooter: {
    marginTop: '8px',
    paddingTop: '16px',
    borderTop: '1px solid var(--border-color)',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  dateInfo: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' },
  deliveryDate: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' },
  viewProjectBtn: { 
    marginTop: '8px',
    padding: '8px 16px', 
    backgroundColor: '#007AFF', 
    color: '#FFFFFF', 
    border: 'none', 
    borderRadius: '10px', 
    fontSize: '13px', 
    fontWeight: 600, 
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    width: '100%',
  },
  statusBadge: {
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: "0.5px",
    textTransform: "uppercase",
  },
  list: { backgroundColor: 'var(--bg-primary)', borderRadius: '20px', border: '1.5px solid var(--border-color)', overflow: 'hidden' },
  listHeader: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr 1fr 1fr',
    padding: '16px 24px',
    backgroundColor: 'var(--bg-secondary)',
    borderBottom: '1.5px solid var(--border-color)',
    fontSize: '13px',
    fontWeight: 700,
    color: 'var(--text-secondary)',
  },
  listItem: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr 1fr 1fr',
    padding: '20px 24px',
    alignItems: 'center',
    borderBottom: '1px solid var(--border-color)',
  },
  colName: { display: 'flex', alignItems: 'center', gap: '16px' },
  colStatus: {},
  colStart: { fontSize: '14px', color: 'var(--text-secondary)' },
  colDelivery: { fontSize: '14px' },
  colActions: { display: 'flex', justifyContent: 'center' },
  listIconWrap: {
    width: '40px',
    height: '40px',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    border: '1px solid var(--border-color)',
  },
  listNameWrap: { overflow: 'hidden' },
  listProjectName: { fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, marginBottom: '2px' },
  listProjectDesc: { fontSize: '12px', color: 'var(--text-secondary)', margin: 0, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' },
  loadingContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '100px' },
  spinner: { width: '32px', height: '32px', border: '3px solid var(--border-color)', borderTopColor: '#007AFF', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  emptyState: { textAlign: 'center', padding: '100px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', backgroundColor: 'var(--bg-secondary)', borderRadius: '20px', margin: '20px' },
  errorState: { textAlign: 'center', padding: '60px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' },
  retryBtn: { padding: '10px 24px', backgroundColor: '#007AFF', color: '#FFFFFF', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' },
  kanban: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' },
  kanbanColumn: { display: 'flex', flexDirection: 'column' as const },
  kanbanHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '2px solid var(--border-color)' },
  kanbanTitle: { fontSize: '14px', fontWeight: 700, margin: 0, textTransform: 'uppercase' as const },
  kanbanCount: { backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 },
  kanbanCards: { display: 'flex', flexDirection: 'column' as const, gap: '12px' },
  kanbanCard: { padding: '16px', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)' },
  kanbanCardHeader: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' },
  kanbanCardName: { fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' },
  kanbanCardDesc: { fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 12px 0', lineHeight: 1.5 },
  kanbanProgress: { marginBottom: '12px' },
  progressHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '6px' },
  progressLabel: { fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 },
  progressValue: { fontSize: '11px', color: 'var(--text-primary)', fontWeight: 700 },
  progressBar: { height: '6px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: '3px', transition: 'width 0.3s ease' },
  kanbanCardFooter: { display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' },
  kanbanCardDate: { fontSize: '11px', color: 'var(--text-secondary)', flex: 1 },
  kanbanViewBtn: { padding: '4px 10px', border: 'none', backgroundColor: '#007AFF', color: '#fff', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' },
  modal: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalContent: { backgroundColor: 'var(--bg-primary)', borderRadius: '20px', maxWidth: '700px', width: '100%', maxHeight: '85vh', overflow: 'auto' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '24px 24px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' },
  modalTitle: { fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, marginBottom: '4px' },
  modalSubtitle: { fontSize: '14px', color: 'var(--text-secondary)', margin: 0 },
  closeBtn: { border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', padding: '8px' },
  tabNav: { display: 'flex', gap: '8px', padding: '16px 24px', borderBottom: '1px solid var(--border-color)' },
  tabBtn: { flex: 1, padding: '10px 16px', border: 'none', backgroundColor: 'transparent', borderRadius: '10px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' },
  tabBtnActive: { backgroundColor: '#007AFF', color: '#fff' },
  modalBody: { padding: '24px' },
  detailsTab: { display: 'flex', flexDirection: 'column', gap: '24px' },
  detailGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' },
  detailRow: { display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' },
  detailLabel: { fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 },
  detailValue: { fontSize: '13px', fontWeight: 600, padding: '4px 12px', borderRadius: '8px' },
  progressSection: { marginTop: '8px' },
  sectionTitle: { fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' },
  sendBtn: { padding: '10px 16px', backgroundColor: '#007AFF', color: '#FFFFFF', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' },
  feedbackTab: { display: 'flex', flexDirection: 'column', gap: '16px' },
  feedbackList: { display: 'flex', flexDirection: 'column' as const, gap: '12px', maxHeight: '300px', overflow: 'auto' },
  feedbackItem: { padding: '16px', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)' },
  feedbackHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '8px' },
  feedbackAuthor: { fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' },
  feedbackTime: { fontSize: '11px', color: 'var(--text-secondary)' },
  feedbackText: { fontSize: '14px', color: 'var(--text-primary)', margin: 0, lineHeight: 1.6 },
  feedbackRating: { fontSize: '12px', color: '#FF9500', margin: '8px 0 0 0', fontWeight: 700 },
  feedbackInputWrap: { display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' },
  feedbackError: { fontSize: '13px', color: '#FF3B30', margin: 0, fontWeight: 600 },
  feedbackSubmitted: { fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0', fontWeight: 600 },
  ratingSelect: { width: '180px', padding: '10px 12px', border: '1.5px solid var(--border-color)', borderRadius: '10px', fontFamily: 'inherit', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' },
  feedbackTextarea: { width: '100%', padding: '12px 14px', border: '1.5px solid var(--border-color)', borderRadius: '12px', fontSize: '14px', fontFamily: 'inherit', outline: 'none', resize: 'vertical' as const, backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' },
  emptyMessage: { textAlign: 'center' as const, padding: '40px 20px', color: 'var(--text-secondary)', fontSize: '14px' },
};
