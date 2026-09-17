import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './useAuth.js';

export const GuestRoute: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { user, status } = useAuth();

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

  if (status === 'authenticated') {
    if (user?.mustChangePassword) {
      return <Navigate to="/change-password" replace />;
    }
    return <Navigate to="/app" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};
