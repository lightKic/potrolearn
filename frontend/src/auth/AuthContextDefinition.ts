import { createContext } from 'react';
import { AuthUser, AuthStatus } from '../types/auth.js';

export interface AuthContextType {
  user: AuthUser | null;
  accessToken: string | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  changePassword: (currentPassword?: string, newPassword?: string) => Promise<void>;
  updateProfile: (name: string) => Promise<AuthUser>;
  setSession: (user: AuthUser, token: string) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
