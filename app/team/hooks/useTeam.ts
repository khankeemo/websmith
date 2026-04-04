// PATH: C:\websmith\app\team\hooks\useTeam.ts
import { useState, useEffect, useCallback } from 'react';
import teamService, { TeamMember, CreateTeamMemberData } from '../services/teamService';

export const useTeam = () => {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all team members
  const fetchTeamMembers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await teamService.getAllTeamMembers();
      setTeamMembers(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch team members');
      console.error('Fetch team members error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Create team member
  const createTeamMember = useCallback(async (data: CreateTeamMemberData) => {
    try {
      setError(null);
      const newMember = await teamService.createTeamMember(data);
      setTeamMembers(prev => [newMember, ...prev]);
      return { success: true, data: newMember };
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to create team member';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, []);

  // Update team member
  const updateTeamMember = useCallback(async (id: string, data: Partial<CreateTeamMemberData>) => {
    try {
      setError(null);
      const updatedMember = await teamService.updateTeamMember(id, data);
      setTeamMembers(prev => prev.map(member => member._id === id ? updatedMember : member));
      return { success: true, data: updatedMember };
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to update team member';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, []);

  // Delete team member
  const deleteTeamMember = useCallback(async (id: string) => {
    try {
      setError(null);
      await teamService.deleteTeamMember(id);
      setTeamMembers(prev => prev.filter(member => member._id !== id));
      return { success: true };
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to delete team member';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, []);

  // Get team members by role
  const filterByRole = useCallback(async (role: string) => {
    try {
      setLoading(true);
      const data = await teamService.getTeamByRole(role);
      setTeamMembers(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to filter team members');
    } finally {
      setLoading(false);
    }
  }, []);

  // Get team members by department
  const filterByDepartment = useCallback(async (department: string) => {
    try {
      setLoading(true);
      const data = await teamService.getTeamByDepartment(department);
      setTeamMembers(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to filter team members');
    } finally {
      setLoading(false);
    }
  }, []);

  // Reset filters (fetch all)
  const resetFilters = useCallback(() => {
    fetchTeamMembers();
  }, [fetchTeamMembers]);

  useEffect(() => {
    fetchTeamMembers();
  }, [fetchTeamMembers]);

  return {
    teamMembers,
    loading,
    error,
    createTeamMember,
    updateTeamMember,
    deleteTeamMember,
    filterByRole,
    filterByDepartment,
    resetFilters,
    refreshTeamMembers: fetchTeamMembers,
  };
};