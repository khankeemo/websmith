// C:\websmith\app\projects\services\projectService.ts
// Project Service - Handles all API calls for projects
// Features: Create, Read, Update, Delete operations

import API from "../../../core/services/apiService";

export interface Project {
  _id?: string;
  name: string;
  description: string;
  client: string;
  clientEmail?: string;
  clientCompany?: string;
  publicUrl?: string;
  previewImage?: string;
  clientId?: string | null;
  assignedDevId?: string | null;
  assignedDeveloperName?: string;
  status: 'pending' | 'in-progress' | 'completed' | 'on-hold';
  priority: 'low' | 'medium' | 'high';
  startDate: string;
  endDate?: string;
  expectedCompletionDate?: string;
  budget?: number;
  customClientId?: string;
  progress?: number;
  published?: boolean;
  sharedFiles?: Array<{
    _id?: string;
    name: string;
    url: string;
    category: "deliverable" | "asset" | "document" | "other";
    uploadedAt?: string;
  }>;
  tasks?: Array<{
    _id: string;
    title: string;
    description?: string;
    status: "pending" | "in-progress" | "completed" | "review";
    priority: "low" | "medium" | "high";
    dueDate?: string;
    assignee?: string;
    developerId?: { _id: string; name: string; email: string; customId?: string } | string | null;
    subtasks?: Array<{ _id?: string; title: string; completed: boolean }>;
    comments?: Array<{ _id?: string; authorName: string; content: string; createdAt: string }>;
  }>;
  statusUpdates?: Array<{
    status: string;
    progress: number;
    note: string;
    createdAt: string;
  }>;
  feedback?: Array<{
    _id?: string;
    rating: number;
    comment: string;
    date: string;
    clientName: string;
    publishedAsTestimonial?: boolean;
    testimonialPublishedAt?: string | null;
  }>;
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

export const updateProjectStatus = async (
  id: string,
  payload: { status: string; progress?: number; note?: string }
): Promise<Project> => {
  try {
    const response = await API.put(`/projects/${id}/status`, payload);
    return response.data.data || response.data;
  } catch (error: any) {
    console.error('Update project status error:', error);
    throw error.response?.data?.message || 'Failed to update project status';
  }
};

export const getProjectFeedback = async (id: string) => {
  try {
    const response = await API.get(`/projects/${id}/feedback`);
    return response.data.data || [];
  } catch (error: any) {
    console.error('Get project feedback error:', error);
    throw error.response?.data?.message || 'Failed to fetch project feedback';
  }
};

export const submitProjectFeedback = async (
  id: string,
  payload: { rating: number; comment: string; clientName?: string }
) => {
  try {
    const response = await API.post(`/projects/${id}/feedback`, payload);
    return response.data.data || [];
  } catch (error: any) {
    console.error('Submit project feedback error:', error);
    throw error.response?.data?.message || 'Failed to submit project feedback';
  }
};

export const toggleFeedbackTestimonial = async (
  projectId: string,
  feedbackId: string,
  published: boolean
) => {
  try {
    const response = await API.patch(`/projects/${projectId}/feedback/${feedbackId}/testimonial`, { published });
    return response.data.data || [];
  } catch (error: any) {
    console.error('Toggle feedback testimonial error:', error);
    throw error.response?.data?.message || 'Failed to update testimonial status';
  }
};

export const deleteProjectFeedback = async (projectId: string, feedbackId: string) => {
  try {
    const response = await API.delete(`/projects/${projectId}/feedback/${feedbackId}`);
    return response.data.data || [];
  } catch (error: any) {
    console.error('Delete project feedback error:', error);
    throw error.response?.data?.message || 'Failed to delete project feedback';
  }
};

export const getPublishedTestimonials = async () => {
  try {
    const response = await API.get('/projects/public/testimonials');
    return response.data.data || [];
  } catch (error: any) {
    console.error('Get published testimonials error:', error);
    throw error.response?.data?.message || 'Failed to fetch testimonials';
  }
};

export const getPublishedProjects = async (): Promise<Project[]> => {
  try {
    const response = await API.get('/projects/public');
    return response.data.data || [];
  } catch (error: any) {
    console.error('Get public projects error:', error);
    throw error.response?.data?.message || 'Failed to fetch public projects';
  }
};

// Bulk update project statuses (for Kanban)
export const bulkUpdateProjectStatus = async (
  updates: Array<{ id: string; status: string; progress?: number }>
): Promise<void> => {
  try {
    await API.post('/projects/bulk-status', { updates });
  } catch (error: any) {
    console.error('Bulk update projects error:', error);
    throw error.response?.data?.message || 'Failed to bulk update projects';
  }
};

// Publish/unpublish project
export const toggleProjectPublish = async (id: string, published: boolean): Promise<Project> => {
  try {
    const response = await API.patch(`/projects/${id}/publish`, { published });
    return response.data.data || response.data;
  } catch (error: any) {
    console.error('Toggle project publish error:', error);
    throw error.response?.data?.message || 'Failed to update project publish status';
  }
};
