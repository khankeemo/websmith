// C:\websmith\app\projects\page.tsx
// Projects Page - Main projects management page
// Features: List projects, add/edit/delete, search, filter by status

'use client';

import { useState } from 'react';
import { Plus, Search, FolderOpen } from 'lucide-react';
import { useProjects } from './hooks/useProjects';
import ProjectCard from './components/ProjectCard';
import ProjectModal from './components/ProjectModal';
import { Project } from './services/projectService';

export default function ProjectsPage() {
  const { projects, loading, error, addProject, editProject, removeProject, fetchProjects } = useProjects();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

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
      <div style={styles.header} className="projects-header">
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
      <div style={styles.searchSection} className="projects-search-section">
        <div style={styles.searchBox}>
          <Search size={18} color="var(--text-secondary)" />
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
      {!loading && !error && filteredProjects.length > 0 && (
        <div style={styles.grid}>
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project._id}
              project={project}
              onEdit={handleEditProject}
              onDelete={handleDeleteProject}
            />
          ))}
        </div>
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
};
