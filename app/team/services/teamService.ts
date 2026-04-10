// PATH: C:\websmith\app\team\services\teamService.ts
import { createDeveloper, deleteDeveloper, getDevelopers, updateDeveloper } from '../../../core/services/userService';

export interface TeamMember {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'developer';
  department?: 'development';
  skills: string[];
  experience: number;
  salary?: number;
  joinDate: string;
  status: 'active' | 'inactive' | 'on-leave';
  avatar?: string;
  bio?: string;
  company?: string;
  customId?: string;
  headline?: string;
  published?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTeamMemberData {
  name: string;
  email: string;
  phone?: string;
  role?: TeamMember['role'];
  department?: TeamMember['department'];
  skills: string[];
  experience: number;
  salary?: number;
  joinDate: string;
  status: TeamMember['status'];
  bio?: string;
  company?: string;
  headline?: string;
  published?: boolean;
}

class TeamService {
  async getAllTeamMembers(): Promise<TeamMember[]> {
    const developers = await getDevelopers();
    return developers.map((developer) => ({
      _id: developer._id,
      name: developer.name,
      email: developer.email,
      phone: developer.phone,
      role: 'developer',
      department: 'development',
      skills: developer.skills || [],
      experience: developer.experienceYears || 0,
      joinDate: developer.joinedAt || new Date().toISOString(),
      status: developer.status || 'active',
      avatar: developer.avatar,
      bio: developer.bio,
      company: developer.company,
      customId: developer.customId,
      headline: developer.headline,
      published: developer.published,
      createdAt: developer.joinedAt || new Date().toISOString(),
      updatedAt: developer.joinedAt || new Date().toISOString(),
    }));
  }

  async createTeamMember(data: CreateTeamMemberData): Promise<TeamMember> {
    const response = await createDeveloper({
      name: data.name,
      email: data.email,
      phone: data.phone,
      company: data.company,
      skills: data.skills,
      experienceYears: data.experience,
      joinedAt: data.joinDate,
      status: data.status,
      bio: data.bio,
      headline: data.headline,
      published: data.published,
    });
    return {
      _id: response.data._id,
      name: response.data.name,
      email: response.data.email,
      phone: response.data.phone,
      role: 'developer',
      department: 'development',
      skills: response.data.skills || [],
      experience: response.data.experienceYears || 0,
      joinDate: response.data.joinedAt || new Date().toISOString(),
      status: response.data.status || 'active',
      avatar: response.data.avatar,
      bio: response.data.bio,
      company: response.data.company,
      customId: response.data.customId,
      headline: response.data.headline,
      published: response.data.published,
      createdAt: response.data.createdAt || new Date().toISOString(),
      updatedAt: response.data.updatedAt || new Date().toISOString(),
    };
  }

  async updateTeamMember(id: string, data: Partial<CreateTeamMemberData>): Promise<TeamMember> {
    const developer = await updateDeveloper(id, {
      name: data.name,
      email: data.email,
      phone: data.phone,
      company: data.company,
      skills: data.skills,
      experienceYears: data.experience,
      joinedAt: data.joinDate,
      status: data.status,
      bio: data.bio,
      headline: data.headline,
      published: data.published,
    });
    return {
      _id: developer._id,
      name: developer.name,
      email: developer.email,
      phone: developer.phone,
      role: 'developer',
      department: 'development',
      skills: developer.skills || [],
      experience: developer.experienceYears || 0,
      joinDate: developer.joinedAt || new Date().toISOString(),
      status: developer.status || 'active',
      avatar: developer.avatar,
      bio: developer.bio,
      company: developer.company,
      customId: developer.customId,
      headline: developer.headline,
      published: developer.published,
      createdAt: developer.createdAt || new Date().toISOString(),
      updatedAt: developer.updatedAt || new Date().toISOString(),
    };
  }

  async deleteTeamMember(id: string): Promise<void> {
    await deleteDeveloper(id);
  }

  async getTeamByRole(_role: string): Promise<TeamMember[]> {
    return this.getAllTeamMembers();
  }

  async getTeamByDepartment(_department: string): Promise<TeamMember[]> {
    return this.getAllTeamMembers();
  }
}

export default new TeamService();
