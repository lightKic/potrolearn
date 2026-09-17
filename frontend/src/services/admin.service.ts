import { apiFetch } from './api.js';
import { AdminUserListItem, AdminUserDetail, AdminUpdateUserInput, AdminCreateUserInput, AdminResetAccessResponse } from '../types/auth.js';

export const AdminService = {
  getUsers: async (): Promise<AdminUserListItem[]> => {
    const data = await apiFetch<{ users: AdminUserListItem[] }>('/admin/users');
    return data.users;
  },

  getUserById: async (userId: string): Promise<AdminUserDetail> => {
    const data = await apiFetch<{ user: AdminUserDetail }>(`/admin/users/${userId}`);
    return data.user;
  },

  updateUser: async (userId: string, input: AdminUpdateUserInput): Promise<AdminUserDetail> => {
    const data = await apiFetch<{ user: AdminUserDetail }>(`/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
    return data.user;
  },

  createUser: async (input: AdminCreateUserInput): Promise<{ user: AdminUserListItem; emailSent: boolean }> => {
    const res = await apiFetch<{ user: AdminUserListItem; emailSent: boolean }>('/admin/users', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return res;
  },

  resetAccess: async (userId: string): Promise<AdminResetAccessResponse> => {
    const res = await apiFetch<AdminResetAccessResponse>(`/admin/users/${userId}/reset-access`, {
      method: 'POST',
    });
    return res;
  },
};
