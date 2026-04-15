// C:\websmith\app\tasks\services\taskService.ts
// Task Service - Handles all API calls for tasks
// Features: Create, Read, Update, Delete operations

import API from "../../../core/services/apiService";

export interface Task {
  _id?: string;
  title: string;
  description: string;
  projectId: string | { _id: string; name: string; status?: string; progress?: number } | null;
  clientId: string | { _id: string; name: string; email: string } | null;
  developerId?: string | { _id: string; name: string; email: string; customId?: string } | null;
  status: 'pending' | 'in-progress' | 'completed' | 'review';
  priority: 'low' | 'medium' | 'high';
  dueDate: string | null;
  assignee: string;
  completionNote?: string;
  completedAt?: string | null;
  subtasks?: Array<{ _id?: string; title: string; completed: boolean }>;
  comments?: Array<{ _id?: string; userId?: string; authorName: string; content: string; createdAt: string }>;
  createdAt?: string;
}

const isMongoObjectIdString = (s: unknown): s is string =>
  typeof s === "string" && /^[a-f0-9]{24}$/i.test(s);

/** Resolve developer id for API; never treat assignee display name as an id. */
const resolveDeveloperId = (task: Partial<Task>) => {
  if (task.developerId === "" || task.developerId === null) return null;
  if (typeof task.developerId === "object" && task.developerId) return task.developerId._id;
  if (typeof task.developerId === "string" && task.developerId) return task.developerId;
  if (task.assignee === "") return null;
  if (isMongoObjectIdString(task.assignee)) return task.assignee;
  return undefined;
};

const normalizeTaskPayload = (task: Partial<Task>) => ({
  ...task,
  title: task.title?.trim() ?? task.title,
  description: task.description ?? "",
  assignee: task.assignee ?? "",
  projectId: task.projectId === "" ? null : typeof task.projectId === "object" ? task.projectId?._id : task.projectId,
  clientId: task.clientId === "" ? null : typeof task.clientId === "object" ? task.clientId?._id : task.clientId,
  developerId: resolveDeveloperId(task),
  dueDate: task.dueDate === "" ? null : task.dueDate,
});

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
    const response = await API.post('/tasks', normalizeTaskPayload(task));
    return response.data.data || response.data;
  } catch (error: any) {
    console.error('Create task error:', error);
    throw error.response?.data?.message || 'Failed to create task';
  }
};

// Update task
export const updateTask = async (id: string, task: Partial<Task>): Promise<Task> => {
  try {
    const response = await API.put(`/tasks/${id}`, normalizeTaskPayload(task));
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

// Bulk update task statuses (for Kanban)
export const bulkUpdateTaskStatus = async (
  updates: Array<{ id: string; status: string }>
): Promise<void> => {
  try {
    await API.post('/tasks/bulk-status', { updates });
  } catch (error: any) {
    console.error('Bulk update tasks error:', error);
    throw error.response?.data?.message || 'Failed to bulk update tasks';
  }
};
