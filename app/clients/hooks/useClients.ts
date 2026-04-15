// C:\websmith\app\clients\hooks\useClients.ts
// Clients Hook - Manages client state and CRUD operations
// Features: Fetch, add, update, delete clients with loading/error states

import { useState, useEffect, useCallback } from 'react';
import { Client, ClientPayload, getClients, createClient, updateClient, deleteClient } from '../services/clientService';

interface UseClientsReturn {
  clients: Client[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  fetchClients: () => Promise<void>;
  addClient: (client: ClientPayload) => Promise<Client | null>;
  editClient: (id: string, client: Partial<Client>) => Promise<Client | null>;
  removeClient: (id: string) => Promise<boolean>;
  clearError: () => void;
}

export const useClients = (): UseClientsReturn => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getClients();
      setClients(data);
    } catch (err: any) {
      setError(typeof err === 'string' ? err : err.message || 'Failed to fetch clients');
    } finally {
      setLoading(false);
    }
  }, []);

  const addClient = useCallback(async (client: ClientPayload): Promise<Client | null> => {
    setSaving(true);
    setError(null);
    try {
      const newClient = await createClient(client);
      await fetchClients();
      return newClient;
    } catch (err: any) {
      setError(typeof err === 'string' ? err : err.message || 'Failed to add client');
      return null;
    } finally {
      setSaving(false);
    }
  }, [fetchClients]);

  const editClient = useCallback(async (id: string, client: Partial<Client>): Promise<Client | null> => {
    setSaving(true);
    setError(null);
    try {
      const updatedClient = await updateClient(id, client);
      await fetchClients();
      return updatedClient;
    } catch (err: any) {
      setError(typeof err === 'string' ? err : err.message || 'Failed to update client');
      return null;
    } finally {
      setSaving(false);
    }
  }, [fetchClients]);

  const removeClient = useCallback(async (id: string): Promise<boolean> => {
    setSaving(true);
    setError(null);
    try {
      await deleteClient(id);
      await fetchClients();
      return true;
    } catch (err: any) {
      setError(typeof err === 'string' ? err : err.message || 'Failed to delete client');
      return false;
    } finally {
      setSaving(false);
    }
  }, [fetchClients]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  return {
    clients,
    loading,
    saving,
    error,
    fetchClients,
    addClient,
    editClient,
    removeClient,
    clearError: () => setError(null),
  };
};
