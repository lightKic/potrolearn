import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './useAuth.js';
import { PageLoading } from '../components/common/loading/index.js';

export const GuestRoute: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { user, status } = useAuth();

  if (status === 'loading') {
    return <PageLoading title="Restaurando tu sesión" description="Verificando tu acceso..." />;
  }

  if (status === 'authenticated') {
    if (user?.mustChangePassword) {
      return <Navigate to="/change-password" replace />;
    }
    return <Navigate to="/app" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};
