// C:\websmith\app\projects\services\projectService.ts
// Project Service - Handles all API calls for projects
// Features: Create, Read, Update, Delete operations

import API from "../../../core/services/apiService";

export interface Project {
  _id?: string;
  name: string;
  description: string;
  client: string;
  status: 'pending' | 'in-progress' | 'completed' | 'on-hold';
  priority: 'low' | 'medium' | 'high';
  startDate: string;
  endDate?: string;
  budget?: number;
  createdAt?: string;
}

export interface ProjectResponse {
  success: boolean;
  data: Project | Project[];
  message?: string;
}

// Get all projects
export const getProjects = async (): Promise<Project[]> => {
  try {
    const response = await API.get('/projects');
    return response.data.data || response.data;
  } catch (error: any) {
    console.error('Get projects error:', error);
    throw error.response?.data?.message || 'Failed to fetch projects';
  }
};

// Get single project
export const getProject = async (id: string): Promise<Project> => {
  try {
    const response = await API.get(`/projects/${id}`);
    return response.data.data || response.data;
  } catch (error: any) {
    console.error('Get project error:', error);
    throw error.response?.data?.message || 'Failed to fetch project';
  }
};

// Create project
export const createProject = async (project: Omit<Project, '_id' | 'createdAt'>): Promise<Project> => {
  try {
    const response = await API.post('/projects', project);
    return response.data.data || response.data;
  } catch (error: any) {
    console.error('Create project error:', error);
    throw error.response?.data?.message || 'Failed to create project';
  }
};

// Update project
export const updateProject = async (id: string, project: Partial<Project>): Promise<Project> => {
  try {
    const response = await API.put(`/projects/${id}`, project);
    return response.data.data || response.data;
  } catch (error: any) {
    console.error('Update project error:', error);
    throw error.response?.data?.message || 'Failed to update project';
  }
};

// Delete project
export const deleteProject = async (id: string): Promise<void> => {
  try {
    await API.delete(`/projects/${id}`);
  } catch (error: any) {
    console.error('Delete project error:', error);
    throw error.response?.data?.message || 'Failed to delete project';
  }
};