import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './useAuth.js';
import { PasswordChangedRoute } from './PasswordChangedRoute.js';
import { PageLoading } from '../components/common/loading/index.js';

export const ProtectedRoute: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { status } = useAuth();

  if (status === 'loading') {
    return <PageLoading title="Restaurando tu sesión" description="Verificando tu acceso..." />;
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  return (
    <PasswordChangedRoute>
      {children ? <>{children}</> : <Outlet />}
    </PasswordChangedRoute>
  );
};
