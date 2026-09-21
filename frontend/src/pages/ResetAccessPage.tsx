import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../layouts/AuthLayout.js';
import { AuthServiceAPI } from '../services/auth.service.js';
import { useAuth } from '../auth/useAuth.js';
import { ApiError } from '../services/api.js';
import { SectionLoading, ButtonSpinner } from '../components/common/loading/index.js';

export const ResetAccessPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const rawToken = searchParams.get('token');
  const navigate = useNavigate();
  const { setSession } = useAuth();

  const [validatingToken, setValidatingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (!rawToken) {
      setValidatingToken(false);
      setTokenValid(false);
      setTokenError('Este enlace de recuperación ya no es válido o ha expirado.');
      return;
    }

    AuthServiceAPI.validateResetToken(rawToken)
      .then((res) => {
        if (isMounted) {
          if (res.valid) {
            setTokenValid(true);
          } else {
            setTokenError('Este enlace de recuperación ya no es válido o ha expirado.');
          }
        }
      })
      .catch(() => {
        if (isMounted) {
          setTokenValid(false);
          setTokenError('Este enlace de recuperación ya no es válido o ha expirado.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setValidatingToken(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [rawToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!rawToken) return;

    if (!email.trim() || !temporaryPassword || !newPassword || !confirmPassword) {
      setErrorMessage('Por favor completa todos los campos.');
      return;
    }

    if (newPassword.length < 10) {
      setErrorMessage('La contraseña debe tener al menos 10 caracteres.');
      return;
    }

    const utf8Length = new TextEncoder().encode(newPassword).length;
    if (utf8Length > 72) {
      setErrorMessage('La contraseña excede el tamaño máximo permitido (72 bytes).');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('La nueva contraseña y su confirmación no coinciden.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await AuthServiceAPI.resetPassword({
        token: rawToken,
        email: email.trim(),
        temporaryPassword,
        newPassword,
      });

      setSession(response.user, response.token);
      navigate('/app', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('No fue posible conectar con PotroLearn. Inténtalo nuevamente en unos momentos.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (validatingToken) {
    return (
      <AuthLayout subtitle="Validando enlace de recuperación...">
        <SectionLoading title="Validando token de restablecimiento..." />
      </AuthLayout>
    );
  }

  if (!tokenValid || tokenError) {
    return (
      <AuthLayout subtitle="Enlace no válido">
        <div className="alert alert-danger" id="reset-invalid-alert">
          {tokenError || 'Este enlace de recuperación ya no es válido o ha expirado.'}
        </div>
        <p className="password-hint" style={{ textAlign: 'center', marginBottom: '20px' }}>
          Solicita a tu profesor o administrador que genere un nuevo restablecimiento de acceso.
        </p>
        <button
          type="button"
          className="btn-secondary"
          style={{ width: '100%' }}
          onClick={() => navigate('/login')}
          id="btn-reset-back-to-login"
        >
          Ir al inicio de sesión
        </button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout subtitle="Establece una nueva contraseña para restablecer tu acceso">
      {errorMessage && (
        <div className="alert alert-danger" role="alert" id="reset-error-alert">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} id="reset-access-form">
        <div className="form-group">
          <label className="form-label" htmlFor="reset-email">
            Correo electrónico
          </label>
          <input
            id="reset-email"
            type="email"
            className="form-input"
            placeholder="usuario@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
            required
            autoComplete="email"
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="reset-temp-password">
            Contraseña temporal (recibida por correo)
          </label>
          <input
            id="reset-temp-password"
            type={showPassword ? 'text' : 'password'}
            className="form-input"
            placeholder="Contraseña temporal"
            value={temporaryPassword}
            onChange={(e) => setTemporaryPassword(e.target.value)}
            disabled={submitting}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="reset-new-password">
            Nueva contraseña
          </label>
          <input
            id="reset-new-password"
            type={showPassword ? 'text' : 'password'}
            className="form-input"
            placeholder="Mínimo 10 caracteres"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={submitting}
            required
          />
          <span className="password-hint">Mínimo 10 caracteres (máximo 72 bytes UTF-8).</span>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="reset-confirm-password">
            Confirmar nueva contraseña
          </label>
          <div className="input-wrapper">
            <input
              id="reset-confirm-password"
              type={showPassword ? 'text' : 'password'}
              className="form-input"
              placeholder="Repite la nueva contraseña"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={submitting}
              required
            />
            <button
              type="button"
              id="toggle-reset-password"
              className="toggle-password-btn"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
        </div>

        <button
          type="submit"
          id="reset-submit"
          className="btn-primary"
          disabled={submitting}
        >
          {submitting ? <><ButtonSpinner /> Restableciendo contraseña...</> : 'Guardar nueva contraseña'}
        </button>
      </form>
    </AuthLayout>
  );
};
