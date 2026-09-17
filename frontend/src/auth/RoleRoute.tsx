import React from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from './useAuth.js';
import { UserRole } from '../types/auth.js';
import { ForbiddenPage } from '../pages/ForbiddenPage.js';

interface RoleRouteProps {
  allowedRoles: UserRole[];
  children?: React.ReactNode;
}

export const RoleRoute: React.FC<RoleRouteProps> = ({ allowedRoles, children }) => {
  const { user } = useAuth();

  if (!user || !allowedRoles.includes(user.role)) {
    return <ForbiddenPage />;
  }

  return children ? <>{children}</> : <Outlet />;
};
