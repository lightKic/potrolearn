import React, { useState, useEffect, useMemo } from 'react';
import { AdminService } from '../services/admin.service.js';
import { AdminUserListItem, AdminUserDetail, UserRole } from '../types/auth.js';
import { ApiError } from '../services/api.js';

export const AdminUsersPage: React.FC = () => {
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filtros
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Modal / Edición de Usuario
  const [selectedUser, setSelectedUser] = useState<AdminUserDetail | null>(null);
  const [modalLoading, setModalLoading] = useState<boolean>(false);
  const [editName, setEditName] = useState<string>('');
  const [editEmail, setEditEmail] = useState<string>('');
  const [editStudentNumber, setEditStudentNumber] = useState<string>('');
  const [editIsActive, setEditIsActive] = useState<boolean>(true);
  const [modalSuccessMessage, setModalSuccessMessage] = useState<string | null>(null);
  const [modalErrorMessage, setModalErrorMessage] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await AdminService.getUsers();
      setUsers(data);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Ocurrió un error al cargar el listado de usuarios.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const getRoleLabel = (role: UserRole) => {
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
    if (!dateStr) return 'Nunca';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'Nunca';
      return new Intl.DateTimeFormat('es-MX', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch {
      return 'Nunca';
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.studentProfile?.studentNumber &&
          u.studentProfile.studentNumber.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, roleFilter]);

  const handleOpenEditModal = async (userId: string) => {
    setModalSuccessMessage(null);
    setModalErrorMessage(null);
    setModalLoading(true);
    try {
      const detail = await AdminService.getUserById(userId);
      setSelectedUser(detail);
      setEditName(detail.name);
      setEditEmail(detail.email);
      setEditStudentNumber(detail.studentProfile?.studentNumber || '');
      setEditIsActive(detail.isActive);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        alert(err.message);
      } else {
        alert('No se pudo cargar el detalle del usuario.');
      }
    } finally {
      setModalLoading(false);
    }
  };

  const handleCloseModal = () => {
    setSelectedUser(null);
    setModalSuccessMessage(null);
    setModalErrorMessage(null);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setModalSuccessMessage(null);
    setModalErrorMessage(null);
    setModalLoading(true);

    try {
      const payload: { name?: string; email?: string; studentNumber?: string; isActive?: boolean } = {};

      if (editName.trim() !== selectedUser.name) {
        payload.name = editName.trim();
      }
      if (editEmail.trim().toLowerCase() !== selectedUser.email.toLowerCase()) {
        payload.email = editEmail.trim().toLowerCase();
      }
      if (editIsActive !== selectedUser.isActive) {
        payload.isActive = editIsActive;
      }
      if (selectedUser.role === 'STUDENT' && editStudentNumber.trim() !== (selectedUser.studentProfile?.studentNumber || '')) {
        payload.studentNumber = editStudentNumber.trim();
      }

      if (Object.keys(payload).length === 0) {
        setModalErrorMessage('No se han realizado cambios en los datos del usuario.');
        setModalLoading(false);
        return;
      }

      const updated = await AdminService.updateUser(selectedUser.id, payload);
      setSelectedUser(updated);
      setModalSuccessMessage('Datos de identidad actualizados correctamente.');
      await fetchUsers();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setModalErrorMessage(err.message);
      } else {
        setModalErrorMessage('Ocurrió un error al actualizar el usuario.');
      }
    } finally {
      setModalLoading(false);
    }
  };

  // Modal / Creación de Usuario
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [createRole, setCreateRole] = useState<UserRole>('STUDENT');
  const [createName, setCreateName] = useState<string>('');
  const [createEmail, setCreateEmail] = useState<string>('');
  const [createStudentNumber, setCreateStudentNumber] = useState<string>('');
  const [createLoading, setCreateLoading] = useState<boolean>(false);
  const [createErrorMessage, setCreateErrorMessage] = useState<string | null>(null);
  const [createSuccessMessage, setCreateSuccessMessage] = useState<string | null>(null);

  // Reset Access Loading State
  const [resetLoading, setResetLoading] = useState<boolean>(false);

  const handleOpenCreateModal = () => {
    setCreateRole('STUDENT');
    setCreateName('');
    setCreateEmail('');
    setCreateStudentNumber('');
    setCreateErrorMessage(null);
    setCreateSuccessMessage(null);
    setIsCreateModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
    setCreateErrorMessage(null);
    setCreateSuccessMessage(null);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateErrorMessage(null);
    setCreateSuccessMessage(null);
    setCreateLoading(true);

    try {
      const res = await AdminService.createUser({
        role: createRole,
        name: createName.trim(),
        email: createEmail.trim(),
        studentNumber: createRole === 'STUDENT' ? createStudentNumber.trim() : undefined,
      });

      setCreateSuccessMessage(
        res.emailSent
          ? `Usuario creado exitosamente. Se ha enviado el correo de activación a ${res.user.email}.`
          : `Usuario creado exitosamente. El correo de activación no pudo ser entregado.`
      );
      await fetchUsers();
      setTimeout(() => {
        handleCloseCreateModal();
      }, 1800);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setCreateErrorMessage(err.message);
      } else {
        setCreateErrorMessage('Ocurrió un error al crear el usuario.');
      }
    } finally {
      setCreateLoading(false);
    }
  };

  const handleResetAccess = async () => {
    if (!selectedUser) return;
    if (!window.confirm(`¿Estás seguro de restablecer el acceso para ${selectedUser.name}? Se regenerará una contraseña temporal y se enviará por correo.`)) {
      return;
    }

    setResetLoading(true);
    setModalSuccessMessage(null);
    setModalErrorMessage(null);

    try {
      const res = await AdminService.resetAccess(selectedUser.id);
      setModalSuccessMessage(res.message);
      await fetchUsers();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setModalErrorMessage(err.message);
      } else {
        setModalErrorMessage('Ocurrió un error al restablecer el acceso del usuario.');
      }
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="admin-users-container" id="admin-users-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h1 className="page-title" id="admin-users-title">Administración de Usuarios</h1>
          <p className="page-description" id="admin-users-description">
            Gestión centralizada e identidad académica de alumnos, maestros y administradores.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={handleOpenCreateModal}
          id="btn-create-user"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          + Nuevo Usuario
        </button>
      </div>

      {errorMessage && (
        <div className="alert alert-danger" role="alert" id="admin-users-error-alert">
          {errorMessage}
        </div>
      )}

      {/* Barra de Búsqueda y Filtros */}
      <div className="dashboard-card" style={{ marginBottom: '24px', padding: '16px' }} id="admin-users-filters-card">
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1', minWidth: '240px' }}>
            <input
              id="users-search-input"
              type="text"
              className="form-input"
              placeholder="Buscar por nombre, correo o matrícula..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ width: '180px' }}>
            <select
              id="users-role-select"
              className="form-input"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="ALL">Todos los roles</option>
              <option value="ADMIN">Administradores</option>
              <option value="TEACHER">Maestros</option>
              <option value="STUDENT">Alumnos</option>
            </select>
          </div>

          <button
            type="button"
            className="btn-secondary"
            onClick={fetchUsers}
            disabled={loading}
            id="users-refresh-btn"
          >
            Actualizar
          </button>
        </div>
      </div>

      {/* Tabla de Usuarios */}
      {loading ? (
        <div className="loading-content" style={{ padding: '40px' }}>
          <div className="loading-spinner" />
          <p className="loading-text">Cargando usuarios...</p>
        </div>
      ) : (
        <div className="dashboard-card" style={{ overflowX: 'auto' }} id="admin-users-table-card">
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }} id="users-data-table">
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
                <th style={{ padding: '12px 16px' }}>Nombre</th>
                <th style={{ padding: '12px 16px' }}>Correo</th>
                <th style={{ padding: '12px 16px' }}>Rol</th>
                <th style={{ padding: '12px 16px' }}>Matrícula</th>
                <th style={{ padding: '12px 16px' }}>Estado</th>
                <th style={{ padding: '12px 16px' }}>Último acceso</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: 'var(--color-muted)' }}>
                    No se encontraron usuarios registrados que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--color-border)' }} className="user-row" id={`user-row-${u.id}`}>
                    <td style={{ padding: '12px 16px', fontWeight: '500' }}>{u.name}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--color-muted)' }}>{u.email}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className={`role-pill ${u.role.toLowerCase()}`}>
                        {getRoleLabel(u.role)}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>
                      {u.studentProfile?.studentNumber || '-'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        className={`status-pill ${u.isActive ? 'active' : 'inactive'}`}
                        style={{
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          backgroundColor: u.isActive ? 'rgba(46, 125, 50, 0.1)' : 'rgba(211, 47, 47, 0.1)',
                          color: u.isActive ? '#2e7d32' : '#d32f2f',
                        }}
                      >
                        {u.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.85rem', color: 'var(--color-muted)' }}>
                      {formatDate(u.lastLoginAt)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: '4px 12px', fontSize: '0.85rem' }}
                        onClick={() => handleOpenEditModal(u.id)}
                        id={`btn-edit-user-${u.id}`}
                      >
                        Detalle / Editar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Creación de Usuario */}
      {isCreateModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
          id="create-user-modal-overlay"
        >
          <div
            className="dashboard-card"
            style={{
              width: '100%',
              maxWidth: '520px',
              backgroundColor: 'var(--color-card-bg, #ffffff)',
              borderRadius: '8px',
              padding: '24px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
            }}
            id="create-user-modal-content"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>
                Crear Nuevo Usuario
              </h2>
              <button
                type="button"
                onClick={handleCloseCreateModal}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--color-muted)' }}
                id="create-modal-close-btn"
              >
                &times;
              </button>
            </div>

            {createSuccessMessage && (
              <div className="alert alert-success" style={{ marginBottom: '16px' }} id="create-modal-success-alert">
                {createSuccessMessage}
              </div>
            )}

            {createErrorMessage && (
              <div className="alert alert-danger" style={{ marginBottom: '16px' }} id="create-modal-error-alert">
                {createErrorMessage}
              </div>
            )}

            <form onSubmit={handleCreateUser} id="create-user-form">
              <div className="form-group">
                <label className="form-label" htmlFor="create-role-select">
                  Rol del Usuario
                </label>
                <select
                  id="create-role-select"
                  className="form-input"
                  value={createRole}
                  onChange={(e) => setCreateRole(e.target.value as UserRole)}
                  disabled={createLoading}
                >
                  <option value="STUDENT">Alumno (STUDENT)</option>
                  <option value="TEACHER">Maestro (TEACHER)</option>
                  <option value="ADMIN">Administrador (ADMIN)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="create-name-input">
                  Nombre Completo
                </label>
                <input
                  id="create-name-input"
                  type="text"
                  className="form-input"
                  placeholder="Ej. Juan Pérez"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  disabled={createLoading}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="create-email-input">
                  Correo Electrónico
                </label>
                <input
                  id="create-email-input"
                  type="email"
                  className="form-input"
                  placeholder="ejemplo@uaemex.mx"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  disabled={createLoading}
                  required
                />
              </div>

              {createRole === 'STUDENT' && (
                <div className="form-group">
                  <label className="form-label" htmlFor="create-student-number-input">
                    Matrícula
                  </label>
                  <input
                    id="create-student-number-input"
                    type="text"
                    className="form-input"
                    placeholder="Ej. 0212345"
                    value={createStudentNumber}
                    onChange={(e) => setCreateStudentNumber(e.target.value)}
                    disabled={createLoading}
                    required
                  />
                  <small style={{ color: 'var(--color-muted)' }}>
                    Preserva ceros iniciales exactamente como en control escolar.
                  </small>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleCloseCreateModal}
                  disabled={createLoading}
                  id="create-modal-cancel-btn"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={createLoading}
                  id="create-modal-submit-btn"
                >
                  {createLoading ? 'Creando...' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal / Drawer de Detalle y Edición */}
      {selectedUser && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
          id="user-edit-modal-overlay"
        >
          <div
            className="dashboard-card"
            style={{
              width: '100%',
              maxWidth: '560px',
              maxHeight: '90vh',
              overflowY: 'auto',
              backgroundColor: 'var(--color-card-bg, #ffffff)',
              borderRadius: '8px',
              padding: '24px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
            }}
            id="user-edit-modal-content"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>
                Detalle y Edición de Usuario
              </h2>
              <button
                type="button"
                onClick={handleCloseModal}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--color-muted)' }}
                id="modal-close-btn"
              >
                &times;
              </button>
            </div>

            {modalSuccessMessage && (
              <div className="alert alert-success" style={{ marginBottom: '16px' }} id="modal-success-alert">
                {modalSuccessMessage}
              </div>
            )}

            {modalErrorMessage && (
              <div className="alert alert-danger" style={{ marginBottom: '16px' }} id="modal-error-alert">
                {modalErrorMessage}
              </div>
            )}

            <form onSubmit={handleSaveUser} id="user-edit-form">
              {/* Metadatos de solo lectura */}
              <div style={{ backgroundColor: 'var(--color-background)', padding: '12px', borderRadius: '6px', marginBottom: '16px', fontSize: '0.85rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div><strong>ID:</strong> <span style={{ fontFamily: 'monospace' }}>{selectedUser.id}</span></div>
                  <div><strong>Rol:</strong> <span className={`role-pill ${selectedUser.role.toLowerCase()}`}>{getRoleLabel(selectedUser.role)}</span></div>
                  <div><strong>Registro:</strong> {formatDate(selectedUser.createdAt)}</div>
                  <div><strong>Último acceso:</strong> {formatDate(selectedUser.lastLoginAt)}</div>
                </div>
              </div>

              {/* Campos editables */}
              <div className="form-group">
                <label className="form-label" htmlFor="edit-name-input">
                  Nombre completo
                </label>
                <input
                  id="edit-name-input"
                  type="text"
                  className="form-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  disabled={modalLoading}
                  required
                  maxLength={100}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-email-input">
                  Correo electrónico
                </label>
                <input
                  id="edit-email-input"
                  type="email"
                  className="form-input"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  disabled={modalLoading}
                  required
                />
              </div>

              {selectedUser.role === 'STUDENT' && (
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-student-number-input">
                    Matrícula de alumno
                  </label>
                  <input
                    id="edit-student-number-input"
                    type="text"
                    className="form-input"
                    value={editStudentNumber}
                    onChange={(e) => setEditStudentNumber(e.target.value)}
                    disabled={modalLoading}
                    required
                    style={{ fontWeight: 'bold' }}
                  />
                  <small style={{ color: 'var(--color-muted)' }}>
                    Se preservarán ceros iniciales y el formato exacto.
                  </small>
                </div>
              )}

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '16px' }}>
                <input
                  id="edit-isactive-checkbox"
                  type="checkbox"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  disabled={modalLoading}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="edit-isactive-checkbox" style={{ cursor: 'pointer', fontWeight: '500' }}>
                  Cuenta Activa (Permite iniciar sesión)
                </label>
              </div>

              {/* Botón Restablecer Acceso */}
              <div style={{ marginTop: '20px', padding: '12px', backgroundColor: 'rgba(239, 68, 68, 0.05)', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#b91c1c' }}>Acceso y Contraseña</h4>
                    <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--color-muted)' }}>
                      Regenera la contraseña temporal y envía un correo para que el usuario recupere su acceso.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleResetAccess}
                    disabled={modalLoading || resetLoading}
                    id="btn-reset-user-access"
                    style={{ fontSize: '0.85rem', borderColor: '#fca5a5', color: '#b91c1c' }}
                  >
                    {resetLoading ? 'Restableciendo...' : 'Restablecer Acceso'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleCloseModal}
                  disabled={modalLoading}
                  id="modal-cancel-btn"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={modalLoading}
                  id="modal-save-btn"
                >
                  {modalLoading ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
