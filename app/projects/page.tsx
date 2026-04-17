// C:\websmith\app\projects\page.tsx
// Projects Page - Main projects management page
// Features: List projects, add/edit/delete, search, filter by status

'use client';

import { useState } from 'react';
import { Plus, Search, FolderOpen, LayoutGrid, List, Kanban, MessageSquareQuote, Star, X } from 'lucide-react';
import { useProjects } from './hooks/useProjects';
import ProjectCard from './components/ProjectCard';
import ProjectModal from './components/ProjectModal';
import KanbanBoard from '../../components/ui/KanbanBoard';
import { Project, bulkUpdateProjectStatus, getProjectFeedback, toggleFeedbackTestimonial, updateProjectStatus } from './services/projectService';

export default function ProjectsPage() {
  const { projects, loading, error, addProject, editProject, removeProject, fetchProjects } = useProjects();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'kanban'>('grid');
  const [feedbackProject, setFeedbackProject] = useState<Project | null>(null);
  const [feedbackItems, setFeedbackItems] = useState<NonNullable<Project['feedback']>>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  const handleAddProject = () => {
    setEditingProject(null);
    setIsModalOpen(true);
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setIsModalOpen(true);
  };

  const handleSaveProject = async (projectData: any) => {
    if (editingProject) {
      await editProject(editingProject._id!, projectData);
    } else {
      await addProject(projectData);
    }
    setIsModalOpen(false);
    setEditingProject(null);
    fetchProjects();
  };

  const handleDeleteProject = async (id: string) => {
    if (confirm('Are you sure you want to delete this project?')) {
      await removeProject(id);
    }
  };

  const handleTogglePublish = async (project: Project) => {
    try {
      const { toggleProjectPublish } = await import('./services/projectService');
      await toggleProjectPublish(project._id!, !project.published);
      await fetchProjects();
    } catch (error) {
      console.error('Toggle publish error:', error);
    }
  };

  const handleMarkCompleted = async (project: Project) => {
    try {
      await updateProjectStatus(project._id!, {
        status: 'completed',
        progress: 100,
        note: 'Project marked as completed',
      });
      await fetchProjects();
    } catch (error) {
      console.error('Mark completed error:', error);
    }
  };

  const handleViewFeedback = async (project: Project) => {
    setFeedbackProject(project);
    setFeedbackLoading(true);
    try {
      const feedback = await getProjectFeedback(project._id!);
      setFeedbackItems(feedback);
    } catch (error) {
      console.error('Load project feedback error:', error);
      setFeedbackItems([]);
    } finally {
      setFeedbackLoading(false);
    }
  };

  const handleToggleTestimonial = async (feedbackId: string, published: boolean) => {
    if (!feedbackProject) return;
    try {
      const feedback = await toggleFeedbackTestimonial(feedbackProject._id!, feedbackId, published);
      setFeedbackItems(feedback);
    } catch (error) {
      console.error('Toggle testimonial error:', error);
    }
  };

  const handleProjectDrop = async (cardId: string, _fromStatus: string, toStatus: string) => {
    await bulkUpdateProjectStatus([{ id: cardId, status: toStatus }]);
    await fetchProjects();
  };

  // Filter projects
  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          project.client.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = {
    all: projects.length,
    pending: projects.filter(p => p.status === 'pending').length,
    'in-progress': projects.filter(p => p.status === 'in-progress').length,
    completed: projects.filter(p => p.status === 'completed').length,
  };

  return (
    <div style={styles.container} className="wsd-page">
      {/* Header */}
      <div style={styles.header} className="projects-header wsd-page-header">
        <div>
          <h1 style={styles.title}>Projects</h1>
          <p style={styles.subtitle}>Manage all your development projects</p>
        </div>
        <button onClick={handleAddProject} style={styles.addBtn} className="add-btn">
          <Plus size={18} />
          <span>New Project</span>
        </button>
      </div>

      {/* Search and Filter */}
      <div style={styles.searchSection} className="projects-search-section wsd-toolbar">
        <div style={styles.searchBox} className="wsd-search-box">
          <Search size={18} color="var(--text-secondary)" />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
        </div>
        <div style={styles.viewToggle}>
          <button onClick={() => setViewMode('grid')} style={{ ...styles.toggleBtn, ...(viewMode === 'grid' ? styles.toggleActive : {}) }}><LayoutGrid size={16} /></button>
          <button onClick={() => setViewMode('list')} style={{ ...styles.toggleBtn, ...(viewMode === 'list' ? styles.toggleActive : {}) }}><List size={16} /></button>
          <button onClick={() => setViewMode('kanban')} style={{ ...styles.toggleBtn, ...(viewMode === 'kanban' ? styles.toggleActive : {}) }}><Kanban size={16} /></button>
        </div>
        <div style={styles.filterTabs} className="wsd-chip-row">
          <button
            onClick={() => setStatusFilter('all')}
            style={{ ...styles.filterTab, ...(statusFilter === 'all' ? styles.filterTabActive : {}) }}
          >
            All ({statusCounts.all})
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            style={{ ...styles.filterTab, ...(statusFilter === 'pending' ? styles.filterTabActive : {}) }}
          >
            Pending ({statusCounts.pending})
          </button>
          <button
            onClick={() => setStatusFilter('in-progress')}
            style={{ ...styles.filterTab, ...(statusFilter === 'in-progress' ? styles.filterTabActive : {}) }}
          >
            In Progress ({statusCounts['in-progress']})
          </button>
          <button
            onClick={() => setStatusFilter('completed')}
            style={{ ...styles.filterTab, ...(statusFilter === 'completed' ? styles.filterTabActive : {}) }}
          >
            Completed ({statusCounts.completed})
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}></div>
          <p style={{ color: "var(--text-secondary)" }}>Loading projects...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div style={styles.errorContainer}>
          <p style={styles.errorText}>{error}</p>
          <button onClick={fetchProjects} style={styles.retryBtn}>Try Again</button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredProjects.length === 0 && (
        <div style={styles.emptyContainer}>
          <FolderOpen size={48} color="var(--border-color)" />
          <h3 style={styles.emptyTitle}>No projects found</h3>
          <p style={styles.emptyText}>
            {searchTerm || statusFilter !== 'all' 
              ? 'Try adjusting your search or filter'
              : 'Create your first project to get started'}
          </p>
          {!searchTerm && statusFilter === 'all' && (
            <button onClick={handleAddProject} style={styles.emptyBtn}>Create Project</button>
          )}
        </div>
      )}

      {/* Projects Grid */}
      {!loading && !error && filteredProjects.length > 0 && viewMode === 'grid' && (
        <div style={styles.grid} className="wsd-card-grid">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project._id}
              project={project}
              onEdit={handleEditProject}
              onDelete={handleDeleteProject}
              onTogglePublish={handleTogglePublish}
              onMarkCompleted={handleMarkCompleted}
              onViewFeedback={handleViewFeedback}
            />
          ))}
        </div>
      )}

      {!loading && !error && filteredProjects.length > 0 && viewMode === 'list' && (
        <div style={styles.list} className="wsd-list">
          {filteredProjects.map((project) => (
            <div key={project._id} style={styles.listRow} className="wsd-list-row">
              <div>
                <strong>{project.name}</strong>
                <p style={styles.listMeta}>{project.client} · {project.assignedDeveloperName || 'Unassigned'}</p>
              </div>
              <span style={styles.listMeta}>{project.status.replace('-', ' ')}</span>
              <span style={styles.listMeta}>{project.expectedCompletionDate ? new Date(project.expectedCompletionDate).toLocaleDateString() : 'No due date'}</span>
              <div style={styles.listActions}>
                {project.status !== 'completed' && (
                  <button onClick={() => handleMarkCompleted(project)} style={{ ...styles.listBtn, color: '#16A34A' }}>Mark as Done</button>
                )}
                <button onClick={() => handleViewFeedback(project)} style={styles.listBtn}>Feedback</button>
                <button onClick={() => handleEditProject(project)} style={styles.listBtn}>Edit</button>
                <button onClick={() => handleDeleteProject(project._id!)} style={{ ...styles.listBtn, color: '#FF3B30' }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && filteredProjects.length > 0 && viewMode === 'kanban' && (
        <KanbanBoard
          columns={[
            { id: 'pending', title: 'Pending', status: 'pending', color: '#FF9500' },
            { id: 'in-progress', title: 'In Progress', status: 'in-progress', color: '#007AFF' },
            { id: 'completed', title: 'Completed', status: 'completed', color: '#34C759' },
            { id: 'on-hold', title: 'On Hold', status: 'on-hold', color: '#FF3B30' },
          ]}
          cards={filteredProjects.map((project) => ({
            ...project,
            _id: project._id!,
            title: project.name,
            subtitle: `${project.client} · ${project.progress || 0}%`,
          }))}
          onCardDrop={handleProjectDrop}
        />
      )}

      {/* Modal */}
      <ProjectModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingProject(null);
        }}
        onSave={handleSaveProject}
        project={editingProject}
      />

      {feedbackProject && (
        <div style={styles.feedbackModalBackdrop} onClick={() => setFeedbackProject(null)}>
          <div style={styles.feedbackModal} onClick={(event) => event.stopPropagation()}>
            <div style={styles.feedbackModalHeader}>
              <div>
                <h2 style={styles.feedbackModalTitle}>Project Feedback</h2>
                <p style={styles.feedbackModalSubtitle}>{feedbackProject.name} · {feedbackProject.client}</p>
              </div>
              <button type="button" onClick={() => setFeedbackProject(null)} style={styles.iconBtn}>
                <X size={18} />
              </button>
            </div>

            {feedbackLoading ? (
              <p style={styles.feedbackEmpty}>Loading feedback...</p>
            ) : feedbackItems.length === 0 ? (
              <p style={styles.feedbackEmpty}>No client feedback has been submitted yet.</p>
            ) : (
              <div style={styles.feedbackList}>
                {feedbackItems.map((feedback) => (
                  <div key={feedback._id} style={styles.feedbackItem}>
                    <div style={styles.feedbackItemHeader}>
                      <div>
                        <strong style={styles.feedbackClient}>{feedback.clientName || feedbackProject.client}</strong>
                        <p style={styles.feedbackMeta}>
                          {feedback.date ? new Date(feedback.date).toLocaleDateString() : 'No date'} · {feedbackProject.clientEmail || 'No email'}
                        </p>
                      </div>
                      <div style={styles.feedbackStars}>
                        {[...Array(feedback.rating || 0)].map((_, index) => (
                          <Star key={index} size={14} fill="#FFB800" color="#FFB800" />
                        ))}
                      </div>
                    </div>
                    <p style={styles.feedbackQuote}>{feedback.comment || 'No comment provided.'}</p>
                    {feedback._id && (
                      <button
                        type="button"
                        onClick={() => handleToggleTestimonial(feedback._id!, !feedback.publishedAsTestimonial)}
                        style={{
                          ...styles.testimonialBtn,
                          ...(feedback.publishedAsTestimonial ? styles.testimonialBtnActive : {}),
                        }}
                      >
                        <MessageSquareQuote size={14} />
                        {feedback.publishedAsTestimonial ? 'Unpublish Testimonial' : 'Publish as Testimonial'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        .add-btn {
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .add-btn:hover {
          background-color: #34C759 !important;
          transform: translateX(4px) translateY(-2px);
          box-shadow: 0 4px 12px rgba(52,199,89,0.3);
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @media (max-width: 768px) {
          .projects-header {
            flex-direction: column !important;
            gap: 16px;
          }
          .projects-search-section {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

const styles: any = {
  container: { 
    padding: '8px 4px',
    backgroundColor: 'var(--bg-primary)',
    minHeight: '100vh',
    color: 'var(--text-primary)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '32px',
  },
  title: {
    fontSize: '34px',
    fontWeight: 700,
    letterSpacing: '-1px',
    color: 'var(--text-primary)',
    margin: 0,
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '15px',
    color: 'var(--text-secondary)',
    margin: 0
  },
  addBtn: {
    padding: '10px 20px',
    backgroundColor: '#007AFF',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontFamily: 'inherit',
  },
  searchSection: {
    marginBottom: '24px',
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    backgroundColor: 'var(--bg-primary)',
    border: '1.5px solid var(--border-color)',
    borderRadius: '14px',
    marginBottom: '16px',
    boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
    flex: 1,
    minWidth: 0,
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: '15px',
    fontFamily: 'inherit',
    backgroundColor: 'transparent',
    color: 'var(--text-primary)',
  },
  filterTabs: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  viewToggle: { display: 'flex', background: 'var(--bg-secondary)', borderRadius: '12px', padding: '4px' },
  toggleBtn: { border: 'none', background: 'transparent', padding: '8px 10px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  toggleActive: { background: 'var(--bg-primary)' },
  filterTab: {
    padding: '8px 18px',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.2s ease',
  },
  filterTabActive: {
    backgroundColor: '#007AFF',
    color: '#FFFFFF',
    borderColor: '#007AFF',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '24px',
  },
  list: { display: 'flex', flexDirection: 'column', gap: '12px' },
  listRow: { display: 'grid', gridTemplateColumns: '1.5fr auto auto auto', gap: '16px', alignItems: 'center', padding: '16px 20px', border: '1.5px solid var(--border-color)', borderRadius: '16px', backgroundColor: 'var(--bg-primary)' },
  listMeta: { margin: 0, fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'capitalize' },
  listActions: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  listBtn: { padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px',
    gap: '16px',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid var(--border-color)',
    borderTopColor: '#007AFF',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  errorContainer: {
    textAlign: 'center',
    padding: '60px',
    backgroundColor: 'rgba(255, 59, 48, 0.05)',
    borderRadius: '16px',
    border: '1px solid rgba(255, 59, 48, 0.1)',
  },
  errorText: {
    color: '#FF3B30',
    marginBottom: '16px',
    fontWeight: 500
  },
  retryBtn: {
    padding: '8px 24px',
    backgroundColor: '#007AFF',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: 600
  },
  emptyContainer: {
    textAlign: 'center',
    padding: '80px 20px',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: '24px',
    border: '1.5px dashed var(--border-color)',
  },
  emptyTitle: {
    fontSize: '20px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginTop: '16px',
    marginBottom: '8px',
  },
  emptyText: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    marginBottom: '20px',
  },
  emptyBtn: {
    padding: '10px 24px',
    backgroundColor: '#007AFF',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: 700,
    fontFamily: 'inherit',
  },
  feedbackModalBackdrop: { position: 'fixed' as const, inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '20px' },
  feedbackModal: { width: '100%', maxWidth: '680px', maxHeight: '86vh', overflow: 'auto', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  feedbackModalHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' },
  feedbackModalTitle: { margin: 0, color: 'var(--text-primary)', fontSize: '22px', fontWeight: 700 },
  feedbackModalSubtitle: { margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '13px' },
  iconBtn: { border: 'none', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', borderRadius: '8px', padding: '8px', cursor: 'pointer', display: 'flex' },
  feedbackEmpty: { color: 'var(--text-secondary)', textAlign: 'center' as const, padding: '36px 12px', margin: 0 },
  feedbackList: { display: 'flex', flexDirection: 'column' as const, gap: '14px' },
  feedbackItem: { padding: '16px', border: '1px solid var(--border-color)', borderRadius: '12px', backgroundColor: 'var(--bg-secondary)' },
  feedbackItemHeader: { display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' },
  feedbackClient: { color: 'var(--text-primary)', fontSize: '14px' },
  feedbackMeta: { margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '12px' },
  feedbackStars: { display: 'flex', gap: '2px', flexShrink: 0 },
  feedbackQuote: { margin: '0 0 14px 0', color: 'var(--text-primary)', fontSize: '14px', lineHeight: 1.6 },
  testimonialBtn: { padding: '9px 12px', border: '1px solid rgba(0, 122, 255, 0.2)', backgroundColor: 'rgba(0, 122, 255, 0.08)', color: '#007AFF', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' },
  testimonialBtnActive: { borderColor: 'rgba(217, 119, 6, 0.25)', backgroundColor: '#FEF3C7', color: '#D97706' },
};
