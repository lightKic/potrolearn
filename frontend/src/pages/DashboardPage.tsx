import React from 'react';
import { useAuth } from '../auth/useAuth.js';
import { AdminDashboard } from '../components/dashboard/AdminDashboard.js';
import { TeacherDashboard } from '../components/dashboard/TeacherDashboard.js';
import { StudentDashboard } from '../components/dashboard/StudentDashboard.js';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  switch (user.role) {
    case 'ADMIN':
      return <AdminDashboard user={user} />;
    case 'TEACHER':
      return <TeacherDashboard user={user} />;
    case 'STUDENT':
      return <StudentDashboard user={user} />;
    default:
      return (
        <div className="alert alert-danger" id="unknown-role-error">
          Error: Rol de usuario no reconocido ({user.role}).
        </div>
      );
  }
};
