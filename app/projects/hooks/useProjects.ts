// C:\websmith\app\projects\hooks\useProjects.ts
// Projects Hook - Manages project state and CRUD operations
// Features: Fetch, add, update, delete projects with loading/error states

import { useState, useEffect, useCallback } from 'react';
import { Project, getProjects, createProject, updateProject, deleteProject } from '../services/projectService';

interface UseProjectsReturn {
  projects: Project[];
  loading: boolean;
  error: string | null;
  fetchProjects: () => Promise<void>;
  addProject: (project: Omit<Project, '_id' | 'createdAt'>) => Promise<Project | null>;
  editProject: (id: string, project: Partial<Project>) => Promise<Project | null>;
  removeProject: (id: string) => Promise<boolean>;
}

export const useProjects = (): UseProjectsReturn => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all projects
  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getProjects();
      setProjects(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch projects');
      console.error('Fetch projects error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Add new project
  const addProject = useCallback(async (project: Omit<Project, '_id' | 'createdAt'>): Promise<Project | null> => {
    setLoading(true);
    setError(null);
    try {
      const newProject = await createProject(project);
      setProjects(prev => [newProject, ...prev]);
      return newProject;
    } catch (err: any) {
      setError(err.message || 'Failed to add project');
      console.error('Add project error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Edit project
  const editProject = useCallback(async (id: string, project: Partial<Project>): Promise<Project | null> => {
    setLoading(true);
    setError(null);
    try {
      const updatedProject = await updateProject(id, project);
      setProjects(prev => prev.map(p => p._id === id ? updatedProject : p));
      return updatedProject;
    } catch (err: any) {
      setError(err.message || 'Failed to update project');
      console.error('Edit project error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Delete project
  const removeProject = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await deleteProject(id);
      setProjects(prev => prev.filter(p => p._id !== id));
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to delete project');
      console.error('Delete project error:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-fetch projects on mount
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return {
    projects,
    loading,
    error,
    fetchProjects,
    addProject,
    editProject,
    removeProject,
  };
};