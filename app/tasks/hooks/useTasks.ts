// C:\websmith\app\tasks\hooks\useTasks.ts
// Tasks Hook - Manages task state and CRUD operations
// Features: Fetch, add, update, delete tasks with loading/error states

import { useState, useEffect, useCallback } from 'react';
import { Task, getTasks, createTask, updateTask, deleteTask } from '../services/taskService';

interface UseTasksReturn {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  fetchTasks: () => Promise<void>;
  addTask: (task: Omit<Task, '_id' | 'createdAt'>) => Promise<Task | null>;
  editTask: (id: string, task: Partial<Task>) => Promise<Task | null>;
  removeTask: (id: string) => Promise<boolean>;
}

export const useTasks = (): UseTasksReturn => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTasks();
      setTasks(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  const addTask = useCallback(async (task: Omit<Task, '_id' | 'createdAt'>): Promise<Task | null> => {
    setLoading(true);
    setError(null);
    try {
      const newTask = await createTask(task);
      setTasks(prev => [newTask, ...prev]);
      return newTask;
    } catch (err: any) {
      setError(err.message || 'Failed to add task');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const editTask = useCallback(async (id: string, task: Partial<Task>): Promise<Task | null> => {
    setLoading(true);
    setError(null);
    try {
      const updatedTask = await updateTask(id, task);
      setTasks(prev => prev.map(t => t._id === id ? updatedTask : t));
      return updatedTask;
    } catch (err: any) {
      setError(err.message || 'Failed to update task');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const removeTask = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await deleteTask(id);
      setTasks(prev => prev.filter(t => t._id !== id));
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to delete task');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return {
    tasks,
    loading,
    error,
    fetchTasks,
    addTask,
    editTask,
    removeTask,
  };
};