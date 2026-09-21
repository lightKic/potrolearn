import React, { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/useAuth.js';
import { NotificationBell } from '../components/notification/NotificationBell.js';

export const AppLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'ADMIN':
        return 'Administrador';
      case 'TEACHER':
        return 'Maestro';
      case 'STUDENT':
        return 'Alumno';
      default:
        return role || '';
    }
  };

  const handleNavClick = (e: React.MouseEvent, targetPath: string) => {
    if (location.pathname.includes('/attempts/') && location.pathname.endsWith('/take')) {
      e.preventDefault();
      window.dispatchEvent(
        new CustomEvent('exam-attempt-leave-request', {
          detail: { targetPath },
        })
      );
    }
  };

  const handleLogoutClick = (e: React.MouseEvent) => {
    if (location.pathname.includes('/attempts/') && location.pathname.endsWith('/take')) {
      e.preventDefault();
      window.dispatchEvent(
        new CustomEvent('exam-attempt-leave-request', {
          detail: { isLogout: true, targetPath: '/login' },
        })
      );
    } else {
      logout();
    }
  };

  const renderNavItems = () => {
    if (!user) return null;

    switch (user.role) {
      case 'ADMIN':
        return (
          <>
            <Link
              to="/app"
              id="nav-home"
              onClick={(e) => handleNavClick(e, '/app')}
              className={`sidebar-nav-item ${location.pathname === '/app' ? 'active' : ''}`}
            >
              Inicio
            </Link>
            <Link
              to="/app/subjects"
              id="nav-subjects"
              onClick={(e) => handleNavClick(e, '/app/subjects')}
              className={`sidebar-nav-item ${location.pathname.startsWith('/app/subjects') ? 'active' : ''}`}
            >
              Materias
            </Link>
            <Link
              to="/app/teachers"
              id="nav-teachers"
              onClick={(e) => handleNavClick(e, '/app/teachers')}
              className={`sidebar-nav-item ${location.pathname.startsWith('/app/teachers') ? 'active' : ''}`}
            >
              Maestros
            </Link>
            <Link
              to="/app/courses"
              id="nav-courses"
              onClick={(e) => handleNavClick(e, '/app/courses')}
              className={`sidebar-nav-item ${location.pathname.startsWith('/app/courses') ? 'active' : ''}`}
            >
              Cursos
            </Link>
            <Link
              to="/app/admin/users"
              id="nav-admin-users"
              onClick={(e) => handleNavClick(e, '/app/admin/users')}
              className={`sidebar-nav-item ${location.pathname.startsWith('/app/admin/users') ? 'active' : ''}`}
            >
              Usuarios
            </Link>
            <Link
              to="/app/profile"
              id="nav-profile"
              onClick={(e) => handleNavClick(e, '/app/profile')}
              className={`sidebar-nav-item ${location.pathname === '/app/profile' ? 'active' : ''}`}
            >
              Mi perfil
            </Link>
          </>
        );

      case 'TEACHER':
        return (
          <>
            <Link
              to="/app"
              id="nav-home"
              onClick={(e) => handleNavClick(e, '/app')}
              className={`sidebar-nav-item ${location.pathname === '/app' ? 'active' : ''}`}
            >
              Inicio
            </Link>
            <Link
              to="/app/courses"
              id="nav-courses"
              onClick={(e) => handleNavClick(e, '/app/courses')}
              className={`sidebar-nav-item ${location.pathname.startsWith('/app/courses') ? 'active' : ''}`}
            >
              Mis cursos
            </Link>
            <Link
              to="/app/students"
              id="nav-students"
              onClick={(e) => handleNavClick(e, '/app/students')}
              className={`sidebar-nav-item ${location.pathname.startsWith('/app/students') ? 'active' : ''}`}
            >
              Alumnos
            </Link>
            <Link
              to="/app/profile"
              id="nav-profile"
              onClick={(e) => handleNavClick(e, '/app/profile')}
              className={`sidebar-nav-item ${location.pathname === '/app/profile' ? 'active' : ''}`}
            >
              Mi perfil
            </Link>
          </>
        );

      case 'STUDENT':
        return (
          <>
            <Link
              to="/app"
              id="nav-home"
              onClick={(e) => handleNavClick(e, '/app')}
              className={`sidebar-nav-item ${location.pathname === '/app' ? 'active' : ''}`}
            >
              Inicio
            </Link>
            <Link
              to="/app/courses"
              id="nav-courses"
              onClick={(e) => handleNavClick(e, '/app/courses')}
              className={`sidebar-nav-item ${location.pathname.startsWith('/app/courses') ? 'active' : ''}`}
            >
              Mis cursos
            </Link>
            <Link
              to="/app/progress"
              id="nav-progress"
              onClick={(e) => handleNavClick(e, '/app/progress')}
              className={`sidebar-nav-item ${location.pathname.startsWith('/app/progress') ? 'active' : ''}`}
            >
              Mi progreso
            </Link>
            <Link
              to="/app/profile"
              id="nav-profile"
              onClick={(e) => handleNavClick(e, '/app/profile')}
              className={`sidebar-nav-item ${location.pathname === '/app/profile' ? 'active' : ''}`}
            >
              Mi perfil
            </Link>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="app-wrapper">
      <header className="app-header">
        <div className="header-brand-container">
          <button
            className="mobile-nav-toggle"
            id="mobile-nav-toggle"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Abrir menú"
          >
            ☰
          </button>
          <Link
            to="/app"
            className="header-brand"
            id="brand-link"
            onClick={(e) => handleNavClick(e, '/app')}
          >
            PotroLearn
          </Link>
        </div>

        <div className="header-user-section">
          {user && <NotificationBell />}
          {user && (
            <Link
              to="/app/profile"
              className="user-badge-info"
              id="header-user-profile-link"
              title="Ver mi perfil"
              style={{ textDecoration: 'none' }}
              onClick={(e) => handleNavClick(e, '/app/profile')}
            >
              <span className="user-name-text" id="user-display-name">
                {user.name}
              </span>
              <span
                className={`role-pill ${user.role.toLowerCase()}`}
                id="user-display-role"
              >
                {getRoleLabel(user.role)}
              </span>
            </Link>
          )}
          <button
            onClick={handleLogoutClick}
            className="btn-logout"
            id="btn-logout"
            title="Cerrar sesión"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <div className="app-body">
        <aside className={`app-sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
          {renderNavItems()}
        </aside>

        <main className="app-main-content">
          {children ? <>{children}</> : <Outlet />}
        </main>
      </div>
    </div>
  );
};

