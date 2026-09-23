// C:\websmith\app\projects\page.tsx
// Projects Page - Main projects management page
// Features: List projects, add/edit/delete, search, filter by status

'use client';

import { useState } from 'react';
import { Plus, Search, FolderOpen, LayoutGrid, List, Kanban, MessageSquareQuote, Star, X, Edit2, Trash2 } from 'lucide-react';
import { useProjects } from './hooks/useProjects';
import ProjectCard from './components/ProjectCard';
import ProjectModal from './components/ProjectModal';
import KanbanBoard from '../../components/ui/KanbanBoard';
import { Project, bulkUpdateProjectStatus, deleteProjectFeedback, getProjectFeedback, toggleFeedbackTestimonial, updateProjectStatus, submitProjectFeedback, updateProjectFeedback } from './services/projectService';
import NavbarVisibilityToggle from '../../components/admin/NavbarVisibilityToggle';

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
  const [isAddingFeedback, setIsAddingFeedback] = useState(false);
  const [editingFeedbackId, setEditingFeedbackId] = useState<string | null>(null);
  const [feedbackForm, setFeedbackForm] = useState({
    clientName: '',
    company: '',
    rating: 5,
    comment: '',
    publishedAsTestimonial: true,
  });
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

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
    setIsAddingFeedback(false);
    setEditingFeedbackId(null);
    setFeedbackError(null);
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

  const handleStartAddFeedback = () => {
    setEditingFeedbackId(null);
    setFeedbackForm({
      clientName: feedbackProject?.client || '',
      company: feedbackProject?.clientCompany || '',
      rating: 5,
      comment: '',
      publishedAsTestimonial: true,
    });
    setFeedbackError(null);
    setIsAddingFeedback(true);
  };

  const handleStartEditFeedback = (fb: any) => {
    setEditingFeedbackId(fb._id);
    setFeedbackForm({
      clientName: fb.clientName || fb.authorName || feedbackProject?.client || '',
      company: fb.company || feedbackProject?.clientCompany || '',
      rating: fb.rating || 5,
      comment: fb.comment || '',
      publishedAsTestimonial: Boolean(fb.publishedAsTestimonial),
    });
    setFeedbackError(null);
    setIsAddingFeedback(true);
  };

  const handleSaveFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackProject) return;
    if (!feedbackForm.comment.trim()) {
      setFeedbackError('Please enter a feedback comment or quote.');
      return;
    }
    setFeedbackSaving(true);
    setFeedbackError(null);
    try {
      let updatedList;
      if (editingFeedbackId) {
        updatedList = await updateProjectFeedback(feedbackProject._id!, editingFeedbackId, {
          clientName: feedbackForm.clientName.trim(),
          authorName: feedbackForm.clientName.trim(),
          company: feedbackForm.company.trim(),
          rating: Number(feedbackForm.rating) || 5,
          comment: feedbackForm.comment.trim(),
          publishedAsTestimonial: feedbackForm.publishedAsTestimonial,
        });
      } else {
        updatedList = await submitProjectFeedback(feedbackProject._id!, {
          clientName: feedbackForm.clientName.trim(),
          authorName: feedbackForm.clientName.trim(),
          company: feedbackForm.company.trim(),
          rating: Number(feedbackForm.rating) || 5,
          comment: feedbackForm.comment.trim(),
          publishedAsTestimonial: feedbackForm.publishedAsTestimonial,
        });
      }
      setFeedbackItems(updatedList);
      setIsAddingFeedback(false);
      setEditingFeedbackId(null);
    } catch (err: any) {
      console.error('Save feedback error:', err);
      setFeedbackError(typeof err === 'string' ? err : 'Failed to save feedback');
    } finally {
      setFeedbackSaving(false);
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

  const handleDeleteFeedback = async (feedbackId: string) => {
    if (!feedbackProject) return;
    if (!confirm('Delete this feedback?')) return;
    try {
      const feedback = await deleteProjectFeedback(feedbackProject._id!, feedbackId);
      setFeedbackItems(feedback);
    } catch (error) {
      console.error('Delete feedback error:', error);
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
    <div style={styles.container} className="wsd-page admin-panel-scope">
      {/* Header */}
      <div style={styles.header} className="projects-header wsd-page-header">
        <div style={styles.headerTitleBlock}>
          <h1 style={styles.title}>Projects</h1>
          <p style={styles.subtitle}>Manage all your development projects</p>
        </div>

        {/* Top & Middle Search */}
        <div style={styles.middleSearchWrap} className="projects-middle-search">
          <div style={styles.searchBox} className="admin-search-box wsd-search-box">
            <Search size={18} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={styles.searchInput}
            />
          </div>
        </div>

        {/* Right Actions */}
        <div style={styles.headerButtons} className="wsd-page-actions">
          <div style={styles.viewToggle}>
            <button onClick={() => setViewMode('grid')} style={{ ...styles.toggleBtn, ...(viewMode === 'grid' ? styles.toggleActive : {}) }} title="Grid view"><LayoutGrid size={16} /></button>
            <button onClick={() => setViewMode('list')} style={{ ...styles.toggleBtn, ...(viewMode === 'list' ? styles.toggleActive : {}) }} title="List view"><List size={16} /></button>
            <button onClick={() => setViewMode('kanban')} style={{ ...styles.toggleBtn, ...(viewMode === 'kanban' ? styles.toggleActive : {}) }} title="Kanban view"><Kanban size={16} /></button>
          </div>
          <NavbarVisibilityToggle
            sectionKey="projects"
            label="Projects"
            variant="compact"
          />
          <button onClick={handleAddProject} style={styles.addBtn} className="admin-primary-btn add-btn">
            <Plus size={16} />
            <span>New Project</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs Row */}
      <div style={styles.filterTabsRow} className="wsd-chip-row">
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
            <div key={project._id} style={styles.listRow} className="wsd-list-row admin-card">
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
          <div style={{ ...styles.feedbackModal, maxWidth: '680px' }} onClick={(event) => event.stopPropagation()}>
            <div style={styles.feedbackModalHeader}>
              <div>
                <h2 style={styles.feedbackModalTitle}>Project Feedback & Testimonials</h2>
                <p style={styles.feedbackModalSubtitle}>{feedbackProject.name} · {feedbackProject.client}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {!isAddingFeedback && (
                  <button
                    type="button"
                    onClick={handleStartAddFeedback}
                    style={{
                      padding: '7px 14px',
                      borderRadius: '10px',
                      backgroundColor: '#007AFF',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Plus size={14} /> Add Testimonial
                  </button>
                )}
                <button type="button" onClick={() => setFeedbackProject(null)} style={styles.iconBtn}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {isAddingFeedback && (
              <form onSubmit={handleSaveFeedback} style={{ padding: '16px', backgroundColor: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-color)', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 12px 0', color: 'var(--text-primary)' }}>
                  {editingFeedbackId ? 'Edit Testimonial / Feedback' : 'New Testimonial / Feedback'}
                </h3>
                {feedbackError && (
                  <p style={{ color: '#FF3B30', fontSize: '13px', margin: '0 0 10px 0' }}>{feedbackError}</p>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-primary)' }}>Client / Author Name *</label>
                    <input
                      type="text"
                      value={feedbackForm.clientName}
                      onChange={(e) => setFeedbackForm({ ...feedbackForm, clientName: e.target.value })}
                      placeholder="e.g. David Vance"
                      required
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-primary)' }}>Company / Title</label>
                    <input
                      type="text"
                      value={feedbackForm.company}
                      onChange={(e) => setFeedbackForm({ ...feedbackForm, company: e.target.value })}
                      placeholder="e.g. CTO, Logix Global"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px' }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-primary)' }}>Rating (1 - 5 Stars)</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFeedbackForm({ ...feedbackForm, rating: star })}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '4px',
                        }}
                      >
                        <Star size={20} fill={star <= feedbackForm.rating ? '#FFB800' : 'none'} color={star <= feedbackForm.rating ? '#FFB800' : 'var(--text-secondary)'} />
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-primary)' }}>Feedback / Testimonial Quote *</label>
                  <textarea
                    rows={3}
                    value={feedbackForm.comment}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, comment: e.target.value })}
                    placeholder="Write client testimonial or feedback quote..."
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px', resize: 'vertical' }}
                  />
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                  <input
                    type="checkbox"
                    checked={feedbackForm.publishedAsTestimonial}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, publishedAsTestimonial: e.target.checked })}
                  />
                  Publish this as a testimonial on the public website
                </label>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => { setIsAddingFeedback(false); setEditingFeedbackId(null); }}
                    style={{ padding: '8px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={feedbackSaving}
                    style={{ padding: '8px 18px', borderRadius: '10px', border: 'none', backgroundColor: '#007AFF', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    {feedbackSaving ? 'Saving...' : editingFeedbackId ? 'Update Feedback' : 'Add Testimonial'}
                  </button>
                </div>
              </form>
            )}

            {feedbackLoading ? (
              <p style={styles.feedbackEmpty}>Loading feedback...</p>
            ) : feedbackItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                <p style={styles.feedbackEmpty}>No client feedback has been submitted yet.</p>
                {!isAddingFeedback && (
                  <button
                    type="button"
                    onClick={handleStartAddFeedback}
                    style={{ marginTop: '8px', padding: '8px 16px', borderRadius: '10px', backgroundColor: '#007AFF', color: '#fff', border: 'none', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    + Add First Testimonial
                  </button>
                )}
              </div>
            ) : (
              <div style={styles.feedbackList}>
                {feedbackItems.map((feedback) => (
                  <div key={feedback._id} style={styles.feedbackItem}>
                    <div style={styles.feedbackItemHeader}>
                      <div>
                        <strong style={styles.feedbackClient}>{feedback.clientName || feedbackProject.client}</strong>
                        <p style={styles.feedbackMeta}>
                          {feedback.company ? feedback.company + ' · ' : ''}
                          {feedback.date ? new Date(feedback.date).toLocaleDateString() : 'No date'}
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
                      <div style={styles.feedbackActions}>
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
                        <button
                          type="button"
                          onClick={() => handleStartEditFeedback(feedback)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-secondary)',
                            color: '#007AFF',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Edit2 size={13} /> Edit
                        </button>
                        <button type="button" onClick={() => handleDeleteFeedback(feedback._id!)} style={styles.deleteFeedbackBtn}>
                          <Trash2 size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Delete
                        </button>
                      </div>
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
    backgroundColor: 'transparent',
    minHeight: '100%',
    width: '100%',
    color: 'var(--text-primary)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '20px',
    marginBottom: '20px',
    width: '100%',
  },
  headerTitleBlock: {
    flexShrink: 0,
    minWidth: '180px',
  },
  middleSearchWrap: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    minWidth: '220px',
  },
  headerButtons: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexShrink: 0,
    flexWrap: 'nowrap',
  },
  filterTabsRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    marginBottom: '24px',
    overflowX: 'auto',
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
  visibilityGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
    gap: '14px',
    marginBottom: '24px',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 18px',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '14px',
    width: '100%',
    boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: '14px',
    fontFamily: 'inherit',
    backgroundColor: 'transparent',
    color: 'var(--text-primary)',
    width: '100%',
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
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '24px',
  },
  list: { display: 'flex', flexDirection: 'column', gap: '12px' },
  listRow: {
    display: 'grid',
    gridTemplateColumns: '1.5fr auto auto auto',
    gap: '16px',
    alignItems: 'center',
    padding: '16px 20px',
    border: '1px solid var(--border-color)',
    borderRadius: '16px',
    backgroundColor: 'var(--bg-secondary)',
    boxShadow: '0 4px 16px rgba(15, 23, 42, 0.05)',
    transition: 'all 0.2s ease',
  },
  listMeta: { margin: 0, fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'capitalize' },
  listActions: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  listBtn: {
    padding: '8px 14px',
    borderRadius: '10px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontWeight: 600,
    fontSize: '13px',
    transition: 'all 0.2s ease',
  },
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
  feedbackModal: { width: '100%', maxWidth: '680px', maxHeight: '86vh', overflow: 'auto', backgroundColor: 'transparent', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
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
  feedbackActions: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  testimonialBtn: { padding: '9px 12px', border: '1px solid rgba(0, 122, 255, 0.2)', backgroundColor: 'rgba(0, 122, 255, 0.08)', color: '#007AFF', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' },
  testimonialBtnActive: { borderColor: 'rgba(217, 119, 6, 0.25)', backgroundColor: '#FEF3C7', color: '#D97706' },
  deleteFeedbackBtn: { padding: '9px 12px', border: '1px solid rgba(255, 59, 48, 0.18)', backgroundColor: 'rgba(255, 59, 48, 0.08)', color: '#FF3B30', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 },
};
