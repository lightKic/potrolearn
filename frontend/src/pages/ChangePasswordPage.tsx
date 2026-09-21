import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth.js';
import { AuthLayout } from '../layouts/AuthLayout.js';
import { ApiError } from '../services/api.js';
import { ButtonSpinner } from '../components/common/loading/index.js';

export const ChangePasswordPage: React.FC = () => {
  const { user, changePassword } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setErrorMessage('Por favor completa todos los campos.');
      return;
    }

    if (newPassword.length < 10) {
      setErrorMessage('La nueva contraseña debe tener al menos 10 caracteres.');
      return;
    }

    const utf8Length = new TextEncoder().encode(newPassword).length;
    if (utf8Length > 72) {
      setErrorMessage('La nueva contraseña excede el tamaño máximo permitido (72 bytes).');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('La nueva contraseña y su confirmación no coinciden.');
      return;
    }

    if (currentPassword === newPassword) {
      setErrorMessage('La nueva contraseña debe ser diferente a la contraseña actual.');
      return;
    }

    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      navigate('/app', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('No fue posible conectar con PotroLearn. Inténtalo nuevamente en unos momentos.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout subtitle={user?.mustChangePassword ? 'Por seguridad debes definir una nueva contraseña para continuar' : 'Actualiza tu contraseña de acceso'}>
      {errorMessage && (
        <div className="alert alert-danger" role="alert" id="change-password-error-alert">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} id="change-password-form">
        <div className="form-group">
          <label className="form-label" htmlFor="change-current-password">
            Contraseña actual o temporal
          </label>
          <input
            id="change-current-password"
            type={showPassword ? 'text' : 'password'}
            className="form-input"
            placeholder="Contraseña actual"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            disabled={loading}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="change-new-password">
            Nueva contraseña
          </label>
          <input
            id="change-new-password"
            type={showPassword ? 'text' : 'password'}
            className="form-input"
            placeholder="Mínimo 10 caracteres"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={loading}
            required
          />
          <span className="password-hint">Mínimo 10 caracteres (máximo 72 bytes UTF-8).</span>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="change-confirm-password">
            Confirmar nueva contraseña
          </label>
          <div className="input-wrapper">
            <input
              id="change-confirm-password"
              type={showPassword ? 'text' : 'password'}
              className="form-input"
              placeholder="Repite la nueva contraseña"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              required
            />
            <button
              type="button"
              id="toggle-change-password"
              className="toggle-password-btn"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
        </div>

        <button
          type="submit"
          id="change-password-submit"
          className="btn-primary"
          disabled={loading}
        >
          {loading ? <><ButtonSpinner /> Actualizando contraseña...</> : 'Actualizar contraseña'}
        </button>
      </form>
    </AuthLayout>
  );
};
