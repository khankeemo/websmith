// C:\websmith\app\projects\page.tsx
// Projects Page - Main projects management page
// Features: List projects, add/edit/delete, search, filter by status

'use client';

import { useState } from 'react';
import { Plus, Search, Filter, FolderOpen, LayoutGrid, List, Kanban, Eye } from 'lucide-react';
import { useProjects } from './hooks/useProjects';
import ProjectCard from './components/ProjectCard';
import ProjectModal from './components/ProjectModal';
import { Project } from './services/projectService';
import KanbanBoard from '../../components/ui/KanbanBoard';
import { bulkUpdateProjectStatus } from './services/projectService';

type ViewMode = 'grid' | 'list' | 'kanban';

export default function ProjectsPage() {
  const { projects, loading, error, addProject, editProject, removeProject, fetchProjects } = useProjects();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [formError, setFormError] = useState<string | null>(null);

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
    await editProject(project._id!, { published: !project.published });
    fetchProjects();
  };

  const handleCardDrop = async (cardId: string, fromStatus: string, toStatus: string) => {
    try {
      const project = projects.find(p => p._id === cardId);
      if (!project) return;

      await editProject(cardId, { status: toStatus as Project['status'] });
      await fetchProjects();
    } catch (error) {
      console.error('Error updating project status:', error);
    }
  };

  const kanbanColumns = [
    { id: 'pending', title: 'Pending', status: 'pending', color: '#FF9500' },
    { id: 'in-progress', title: 'In Progress', status: 'in-progress', color: '#007AFF' },
    { id: 'completed', title: 'Completed', status: 'completed', color: '#34C759' },
  ];

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
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Projects</h1>
          <p style={styles.subtitle}>Manage all your development projects</p>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.viewToggle}>
            <button onClick={() => setViewMode('grid')} style={{ ...styles.toggleBtn, ...(viewMode === 'grid' ? styles.toggleActive : {}) }}>
              <LayoutGrid size={16} />
            </button>
            <button onClick={() => setViewMode('list')} style={{ ...styles.toggleBtn, ...(viewMode === 'list' ? styles.toggleActive : {}) }}>
              <List size={16} />
            </button>
            <button onClick={() => setViewMode('kanban')} style={{ ...styles.toggleBtn, ...(viewMode === 'kanban' ? styles.toggleActive : {}) }}>
              <Kanban size={16} />
            </button>
          </div>
          <button onClick={handleAddProject} style={styles.addBtn} className="add-btn">
            <Plus size={18} />
            <span>New Project</span>
          </button>
        </div>
      </div>

      {/* Search and Filter */}
      <div style={styles.searchSection}>
        <div style={styles.searchBox}>
          <Search size={18} color="#8E8E93" />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
        </div>
        <div style={styles.filterTabs}>
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
          <p>Loading projects...</p>
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
          <FolderOpen size={48} color="#C6C6C8" />
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

      {/* Projects Display */}
      {!loading && !error && filteredProjects.length > 0 && (
        <>
          {viewMode === 'kanban' ? (
            <KanbanBoard
              columns={kanbanColumns}
              cards={filteredProjects.filter(p => p._id).map(p => ({
                _id: p._id!,
                title: p.name,
                subtitle: `Client: ${p.client}`,
                status: p.status,
              }))}
              onCardDrop={handleCardDrop}
            />
          ) : (
            <div style={viewMode === 'grid' ? styles.grid : styles.list}>
              {filteredProjects.map((project) => (
                <ProjectCard
                  key={project._id}
                  project={project}
                  onEdit={handleEditProject}
                  onDelete={handleDeleteProject}
                  onTogglePublish={handleTogglePublish}
                />
              ))}
            </div>
          )}
        </>
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
      `}</style>
    </div>
  );
}

const styles: any = {
  container: {
    padding: '8px 4px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '32px',
  },
  title: {
    fontSize: '34px',
    fontWeight: 600,
    letterSpacing: '-0.5px',
    color: '#1C1C1E',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '15px',
    color: '#8E8E93',
  },
  headerRight: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  viewToggle: {
    display: 'flex',
    background: '#F2F2F7',
    borderRadius: '12px',
    padding: '4px',
  },
  toggleBtn: {
    border: 'none',
    background: 'transparent',
    padding: '8px 10px',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  toggleActive: {
    background: '#fff',
  },
  addBtn: {
    padding: '10px 20px',
    backgroundColor: '#007AFF',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontFamily: 'inherit',
  },
  searchSection: {
    marginBottom: '24px',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    backgroundColor: '#FFFFFF',
    border: '1px solid #E5E5EA',
    borderRadius: '12px',
    marginBottom: '16px',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: '15px',
    fontFamily: 'inherit',
    backgroundColor: 'transparent',
  },
  filterTabs: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  filterTab: {
    padding: '6px 16px',
    backgroundColor: '#F2F2F7',
    border: 'none',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: 500,
    color: '#8E8E93',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.2s ease',
  },
  filterTabActive: {
    backgroundColor: '#007AFF',
    color: '#FFFFFF',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
    gap: '20px',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
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
    border: '3px solid #E5E5EA',
    borderTopColor: '#007AFF',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  errorContainer: {
    textAlign: 'center',
    padding: '60px',
    backgroundColor: '#FEF2F0',
    borderRadius: '16px',
  },
  errorText: {
    color: '#FF3B30',
    marginBottom: '16px',
  },
  retryBtn: {
    padding: '8px 20px',
    backgroundColor: '#007AFF',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  emptyContainer: {
    textAlign: 'center',
    padding: '60px',
  },
  emptyTitle: {
    fontSize: '20px',
    fontWeight: 600,
    color: '#1C1C1E',
    marginTop: '16px',
    marginBottom: '8px',
  },
  emptyText: {
    fontSize: '14px',
    color: '#8E8E93',
    marginBottom: '20px',
  },
  emptyBtn: {
    padding: '10px 24px',
    backgroundColor: '#007AFF',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};
