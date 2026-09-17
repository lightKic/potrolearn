import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './useAuth.js';
import { PasswordChangedRoute } from './PasswordChangedRoute.js';

export const ProtectedRoute: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <div className="loading-screen" id="loading-screen">
        <div className="loading-content">
          <div className="loading-logo">PotroLearn</div>
          <div className="loading-spinner" />
          <p className="loading-text">Cargando...</p>
        </div>
      </div>
    );
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
