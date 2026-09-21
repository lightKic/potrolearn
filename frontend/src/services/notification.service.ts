import { apiFetch } from './api.js';
import { NotificationItem, UnreadCountResponse } from '../types/notification.js';

export const NotificationServiceAPI = {
  getNotifications: async (limit: number = 30): Promise<NotificationItem[]> => {
    return apiFetch<NotificationItem[]>(`/notifications?limit=${limit}`, { method: 'GET' });
  },

  getUnreadCount: async (): Promise<UnreadCountResponse> => {
    return apiFetch<UnreadCountResponse>('/notifications/unread-count', { method: 'GET' });
  },

  markAsRead: async (id: string): Promise<NotificationItem> => {
    return apiFetch<NotificationItem>(`/notifications/${id}/read`, { method: 'PATCH' });
  },

  markAllAsRead: async (): Promise<{ count: number }> => {
    return apiFetch<{ count: number }>('/notifications/read-all', { method: 'PATCH' });
  },
};
