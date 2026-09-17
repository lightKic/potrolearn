import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth.js';

export const PasswordChangedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();

  if (user?.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  return <>{children}</>;
};
