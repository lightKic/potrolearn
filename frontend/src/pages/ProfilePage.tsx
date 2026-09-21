import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth.js';
import { PageLoading } from '../components/common/loading/index.js';

export const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return <PageLoading title="Cargando perfil..." />;
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'Administrador';
      case 'TEACHER':
        return 'Maestro';
      case 'STUDENT':
        return 'Alumno';
      default:
        return role;
    }
  };

  const formatDate = (dateStr?: string | Date | null) => {
    if (!dateStr) return 'No disponible';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'No disponible';
      return new Intl.DateTimeFormat('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch {
      return 'No disponible';
    }
  };

  return (
    <div className="profile-page-container" id="profile-page">
      <h1 className="page-title" id="profile-page-title">Mi perfil</h1>
      <p className="page-description" id="profile-page-description">
        Consulta tu información personal y de seguridad de tu cuenta.
      </p>

      <div style={{ display: 'grid', gap: '24px', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        {/* Tarjeta de Información Personal */}
        <div className="dashboard-card" id="profile-personal-card">
          <h2 className="dashboard-card-title" style={{ marginBottom: '16px', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>
            Información personal
          </h2>

          <div id="profile-info-details">
            <div className="form-group">
              <label className="form-label" htmlFor="profile-name-input">
                Nombre completo <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 'normal' }}>(solo lectura)</span>
              </label>
              <input
                id="profile-name-input"
                type="text"
                className="form-input"
                value={user.name}
                disabled
                readOnly
                style={{ backgroundColor: 'var(--color-background)', cursor: 'not-allowed' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="profile-email-input">
                Correo electrónico <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 'normal' }}>(solo lectura)</span>
              </label>
              <input
                id="profile-email-input"
                type="email"
                className="form-input"
                value={user.email}
                disabled
                readOnly
                style={{ backgroundColor: 'var(--color-background)', cursor: 'not-allowed' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="profile-role-input">
                Rol <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 'normal' }}>(solo lectura)</span>
              </label>
              <input
                id="profile-role-input"
                type="text"
                className="form-input"
                value={getRoleLabel(user.role)}
                disabled
                readOnly
                style={{ backgroundColor: 'var(--color-background)', cursor: 'not-allowed' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="profile-status-input">
                Estado de cuenta <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 'normal' }}>(solo lectura)</span>
              </label>
              <input
                id="profile-status-input"
                type="text"
                className="form-input"
                value={user.isActive !== false ? 'Activo' : 'Inactivo'}
                disabled
                readOnly
                style={{ backgroundColor: 'var(--color-background)', cursor: 'not-allowed' }}
              />
            </div>

            {user.role === 'STUDENT' && (
              <div className="form-group">
                <label className="form-label" htmlFor="profile-student-number-input">
                  Matrícula <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 'normal' }}>(solo lectura)</span>
                </label>
                <input
                  id="profile-student-number-input"
                  type="text"
                  className="form-input"
                  value={user.studentProfile?.studentNumber || 'No asignada'}
                  disabled
                  readOnly
                  style={{ backgroundColor: 'var(--color-background)', cursor: 'not-allowed', fontWeight: 'bold' }}
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Fecha de registro</label>
              <p style={{ fontSize: '0.9rem', color: 'var(--color-muted)', padding: '6px 0' }}>
                {formatDate(user.createdAt)}
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">Último acceso</label>
              <p style={{ fontSize: '0.9rem', color: 'var(--color-muted)', padding: '6px 0' }}>
                {formatDate(user.lastLoginAt)}
              </p>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Seguridad & Admin */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Tarjeta de Seguridad */}
          <div className="dashboard-card" id="profile-security-card">
            <h2 className="dashboard-card-title" style={{ marginBottom: '16px', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>
              Seguridad
            </h2>

            <p className="dashboard-card-desc" style={{ marginBottom: '20px' }}>
              Mantén tu cuenta protegida actualizando periódicamente tu contraseña.
            </p>

            <div className="form-group">
              <label className="form-label">Contraseña</label>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-muted)', marginBottom: '16px' }}>
                Se recomienda utilizar al menos 10 caracteres combinando letras y números.
              </p>
              <button
                type="button"
                id="btn-goto-change-password"
                className="btn-secondary"
                onClick={() => navigate('/change-password')}
              >
                Cambiar contraseña
              </button>
            </div>
          </div>

          {/* Tarjeta de Administración de Usuarios (Exclusiva ADMIN) */}
          {user.role === 'ADMIN' && (
            <div className="dashboard-card" id="profile-admin-card">
              <h2 className="dashboard-card-title" style={{ marginBottom: '16px', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>
                Administración de Usuarios
              </h2>
              <p className="dashboard-card-desc" style={{ marginBottom: '20px' }}>
                Como Administrador, puedes consultar y corregir los datos de identidad académica de todos los usuarios registrados.
              </p>
              <button
                type="button"
                id="btn-goto-admin-users"
                className="btn-primary"
                onClick={() => navigate('/app/admin/users')}
              >
                Ir a Gestión de Usuarios
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
