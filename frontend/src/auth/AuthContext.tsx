import React, { useState, useEffect, useCallback, ReactNode } from 'react';
import { AuthUser, AuthStatus } from '../types/auth.js';
import { AuthServiceAPI } from '../services/auth.service.js';
import { setAccessToken, setOnUnauthenticatedHandler, ApiError } from '../services/api.js';
import { AuthContext } from './AuthContextDefinition.js';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  const updateMemoryToken = useCallback((token: string | null) => {
    setAccessTokenState(token);
    setAccessToken(token);
  }, []);

  const setSession = useCallback(
    (newUser: AuthUser, newToken: string) => {
      updateMemoryToken(newToken);
      setUser(newUser);
      setStatus('authenticated');
    },
    [updateMemoryToken],
  );

  const restoreSession = useCallback(async () => {
    setStatus('loading');
    try {
      const refreshResult = await AuthServiceAPI.refresh();
      if (refreshResult?.token) {
        updateMemoryToken(refreshResult.token);
        if (refreshResult.user) {
          setUser(refreshResult.user);
          setStatus('authenticated');
          return;
        }
        const meResult = await AuthServiceAPI.getMe();
        setUser(meResult.user);
        setStatus('authenticated');
        return;
      }
      updateMemoryToken(null);
      setUser(null);
      setStatus('unauthenticated');
    } catch {
      updateMemoryToken(null);
      setUser(null);
      setStatus('unauthenticated');
    }
  }, [updateMemoryToken]);

  useEffect(() => {
    setOnUnauthenticatedHandler(() => {
      updateMemoryToken(null);
      setUser(null);
      setStatus('unauthenticated');
    });

    restoreSession();
  }, [restoreSession, updateMemoryToken]);

  const login = async (email: string, password: string): Promise<AuthUser> => {
    try {
      const response = await AuthServiceAPI.login({ email, password });
      updateMemoryToken(response.token);
      setUser(response.user);
      setStatus('authenticated');
      return response.user;
    } catch (err) {
      updateMemoryToken(null);
      setUser(null);
      setStatus('unauthenticated');
      throw err;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await AuthServiceAPI.logout();
    } catch {
      // Incluso si falla la red, limpiamos la sesión local
    } finally {
      updateMemoryToken(null);
      setUser(null);
      setStatus('unauthenticated');
    }
  };

  const changePassword = async (currentPassword?: string, newPassword?: string): Promise<void> => {
    const response = await AuthServiceAPI.changePassword({ currentPassword, newPassword });
    if (response.token) {
      updateMemoryToken(response.token);
    }
    try {
      const meResult = await AuthServiceAPI.getMe();
      setUser(meResult.user);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        updateMemoryToken(null);
        setUser(null);
        setStatus('unauthenticated');
      }
      throw err;
    }
  };

  const updateProfile = async (name: string): Promise<AuthUser> => {
    const response = await AuthServiceAPI.updateProfile({ name });
    setUser(response.user);
    return response.user;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        status,
        login,
        logout,
        restoreSession,
        changePassword,
        updateProfile,
        setSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
