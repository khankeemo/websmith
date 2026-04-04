// PATH: C:\websmith\app\team\services\teamService.ts
import apiService from '../../../core/services/apiService';

export interface TeamMember {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'admin' | 'developer' | 'designer' | 'manager' | 'intern';
  department: 'development' | 'design' | 'management' | 'sales' | 'support';
  skills: string[];
  experience: number;
  salary?: number;
  joinDate: string;
  status: 'active' | 'inactive' | 'on-leave';
  avatar?: string;
  bio?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTeamMemberData {
  name: string;
  email: string;
  phone?: string;
  role: TeamMember['role'];
  department: TeamMember['department'];
  skills: string[];
  experience: number;
  salary?: number;
  joinDate: string;
  status: TeamMember['status'];
  bio?: string;
}

class TeamService {
  async getAllTeamMembers(): Promise<TeamMember[]> {
    const response = await apiService.get('/team');
    return response.data.data;
  }

  async getTeamMemberById(id: string): Promise<TeamMember> {
    const response = await apiService.get(`/team/${id}`);
    return response.data.data;
  }

  async createTeamMember(data: CreateTeamMemberData): Promise<TeamMember> {
    const response = await apiService.post('/team', data);
    return response.data.data;
  }

  async updateTeamMember(id: string, data: Partial<CreateTeamMemberData>): Promise<TeamMember> {
    const response = await apiService.put(`/team/${id}`, data);
    return response.data.data;
  }

  async deleteTeamMember(id: string): Promise<void> {
    await apiService.delete(`/team/${id}`);
  }

  async getTeamByRole(role: string): Promise<TeamMember[]> {
    const response = await apiService.get(`/team/role/${role}`);
    return response.data.data;
  }

  async getTeamByDepartment(department: string): Promise<TeamMember[]> {
    const response = await apiService.get(`/team/department/${department}`);
    return response.data.data;
  }
}

export default new TeamService();