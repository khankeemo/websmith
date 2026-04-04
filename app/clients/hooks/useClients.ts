// C:\websmith\app\clients\hooks\useClients.ts
// Clients Hook - Manages client state and CRUD operations
// Features: Fetch, add, update, delete clients with loading/error states

import { useState, useEffect, useCallback } from 'react';
import { Client, getClients, createClient, updateClient, deleteClient } from '../services/clientService';

interface UseClientsReturn {
  clients: Client[];
  loading: boolean;
  error: string | null;
  fetchClients: () => Promise<void>;
  addClient: (client: Omit<Client, '_id' | 'createdAt'>) => Promise<Client | null>;
  editClient: (id: string, client: Partial<Client>) => Promise<Client | null>;
  removeClient: (id: string) => Promise<boolean>;
}

export const useClients = (): UseClientsReturn => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getClients();
      setClients(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch clients');
    } finally {
      setLoading(false);
    }
  }, []);

  const addClient = useCallback(async (client: Omit<Client, '_id' | 'createdAt'>): Promise<Client | null> => {
    setLoading(true);
    setError(null);
    try {
      const newClient = await createClient(client);
      setClients(prev => [newClient, ...prev]);
      return newClient;
    } catch (err: any) {
      setError(err.message || 'Failed to add client');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const editClient = useCallback(async (id: string, client: Partial<Client>): Promise<Client | null> => {
    setLoading(true);
    setError(null);
    try {
      const updatedClient = await updateClient(id, client);
      setClients(prev => prev.map(c => c._id === id ? updatedClient : c));
      return updatedClient;
    } catch (err: any) {
      setError(err.message || 'Failed to update client');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const removeClient = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await deleteClient(id);
      setClients(prev => prev.filter(c => c._id !== id));
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to delete client');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  return {
    clients,
    loading,
    error,
    fetchClients,
    addClient,
    editClient,
    removeClient,
  };
};