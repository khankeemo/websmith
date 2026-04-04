// C:\websmith\app\tasks\services\taskService.ts
// Task Service - Handles all API calls for tasks
// Features: Create, Read, Update, Delete operations

import API from "../../../core/services/apiService";

export interface Task {
  _id?: string;
  title: string;
  description: string;
  projectId: string | null;
  clientId: string | null;
  status: 'pending' | 'in-progress' | 'completed' | 'review';
  priority: 'low' | 'medium' | 'high';
  dueDate: string | null;
  assignee: string;
  createdAt?: string;
}

// Get all tasks
export const getTasks = async (): Promise<Task[]> => {
  try {
    const response = await API.get('/tasks');
    return response.data.data || response.data;
  } catch (error: any) {
    console.error('Get tasks error:', error);
    throw error.response?.data?.message || 'Failed to fetch tasks';
  }
};

// Get single task
export const getTask = async (id: string): Promise<Task> => {
  try {
    const response = await API.get(`/tasks/${id}`);
    return response.data.data || response.data;
  } catch (error: any) {
    console.error('Get task error:', error);
    throw error.response?.data?.message || 'Failed to fetch task';
  }
};

// Create task
export const createTask = async (task: Omit<Task, '_id' | 'createdAt'>): Promise<Task> => {
  try {
    const response = await API.post('/tasks', task);
    return response.data.data || response.data;
  } catch (error: any) {
    console.error('Create task error:', error);
    throw error.response?.data?.message || 'Failed to create task';
  }
};

// Update task
export const updateTask = async (id: string, task: Partial<Task>): Promise<Task> => {
  try {
    const response = await API.put(`/tasks/${id}`, task);
    return response.data.data || response.data;
  } catch (error: any) {
    console.error('Update task error:', error);
    throw error.response?.data?.message || 'Failed to update task';
  }
};

// Delete task
export const deleteTask = async (id: string): Promise<void> => {
  try {
    await API.delete(`/tasks/${id}`);
  } catch (error: any) {
    console.error('Delete task error:', error);
    throw error.response?.data?.message || 'Failed to delete task';
  }
};