import { apiFetch, executeSingleFlightRefresh } from './api.js';
import {
  AuthUser,
  LoginResponseData,
  RefreshResponseData,
  GetMeResponseData,
  ActivateValidateResponseData,
  ActivateAccountResponseData,
  ResetValidateResponseData,
  ResetPasswordResponseData,
  ChangePasswordResponseData,
  LogoutResponseData,
} from '../types/auth.js';

export const AuthServiceAPI = {
  login: async (credentials: { email: string; password: string }): Promise<LoginResponseData> => {
    return apiFetch<LoginResponseData>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  logout: async (): Promise<LogoutResponseData> => {
    return apiFetch<LogoutResponseData>('/auth/logout', {
      method: 'POST',
    });
  },

  getMe: async (): Promise<{ user: AuthUser }> => {
    const data = await apiFetch<GetMeResponseData>('/auth/me', {
      method: 'GET',
    });
    return data;
  },

  refresh: async (): Promise<RefreshResponseData | null> => {
    return executeSingleFlightRefresh();
  },

  validateActivationToken: async (token: string): Promise<ActivateValidateResponseData> => {
    return apiFetch<ActivateValidateResponseData>('/auth/validate-activation-token', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },

  activateAccount: async (payload: {
    token: string;
    email: string;
    temporaryPassword: string;
    newPassword: string;
  }): Promise<ActivateAccountResponseData> => {
    return apiFetch<ActivateAccountResponseData>('/auth/activate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  validateResetToken: async (token: string): Promise<ResetValidateResponseData> => {
    return apiFetch<ResetValidateResponseData>('/auth/validate-reset-token', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },

  resetPassword: async (payload: {
    token: string;
    email: string;
    temporaryPassword: string;
    newPassword: string;
  }): Promise<ResetPasswordResponseData> => {
    return apiFetch<ResetPasswordResponseData>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  changePassword: async (payload: {
    currentPassword?: string;
    newPassword?: string;
  }): Promise<ChangePasswordResponseData> => {
    return apiFetch<ChangePasswordResponseData>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateProfile: async (payload: { name: string }): Promise<{ user: AuthUser }> => {
    return apiFetch<{ user: AuthUser }>('/auth/me', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },
};
