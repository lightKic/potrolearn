import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../layouts/AuthLayout.js';
import { AuthServiceAPI } from '../services/auth.service.js';
import { useAuth } from '../auth/useAuth.js';
import { ApiError } from '../services/api.js';
import { SectionLoading, ButtonSpinner } from '../components/common/loading/index.js';

export const ActivatePage: React.FC = () => {
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
      setTokenError('Esta invitación ya no es válida o ha expirado. Solicita al responsable del curso que reenvíe tu invitación.');
      return;
    }

    AuthServiceAPI.validateActivationToken(rawToken)
      .then((res) => {
        if (isMounted) {
          if (res.valid) {
            setTokenValid(true);
          } else {
            setTokenError('Esta invitación ya no es válida o ha expirado. Solicita al responsable del curso que reenvíe tu invitación.');
          }
        }
      })
      .catch(() => {
        if (isMounted) {
          setTokenValid(false);
          setTokenError('Esta invitación ya no es válida o ha expirado. Solicita al responsable del curso que reenvíe tu invitación.');
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
      const response = await AuthServiceAPI.activateAccount({
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
      <AuthLayout subtitle="Validando invitación de cuenta...">
        <SectionLoading title="Validando enlace de activación..." />
      </AuthLayout>
    );
  }

  if (!tokenValid || tokenError) {
    return (
      <AuthLayout subtitle="Invitación no válida">
        <div className="alert alert-danger" id="activate-invalid-alert">
          {tokenError || 'Esta invitación ya no es válida o ha expirado.'}
        </div>
        <p className="password-hint" style={{ textAlign: 'center', marginBottom: '20px' }}>
          Si necesitas un nuevo enlace de activación, contacta a tu profesor o administrador.
        </p>
        <button
          type="button"
          className="btn-secondary"
          style={{ width: '100%' }}
          onClick={() => navigate('/login')}
          id="btn-back-to-login"
        >
          Ir al inicio de sesión
        </button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout subtitle="Completa tus datos para activar tu cuenta e ingresar a PotroLearn">
      {errorMessage && (
        <div className="alert alert-danger" role="alert" id="activate-error-alert">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} id="activate-form">
        <div className="form-group">
          <label className="form-label" htmlFor="activate-email">
            Correo electrónico registrado
          </label>
          <input
            id="activate-email"
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
          <label className="form-label" htmlFor="activate-temp-password">
            Contraseña temporal (recibida por correo)
          </label>
          <input
            id="activate-temp-password"
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
          <label className="form-label" htmlFor="activate-new-password">
            Nueva contraseña definitiva
          </label>
          <input
            id="activate-new-password"
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
          <label className="form-label" htmlFor="activate-confirm-password">
            Confirmar nueva contraseña
          </label>
          <div className="input-wrapper">
            <input
              id="activate-confirm-password"
              type={showPassword ? 'text' : 'password'}
              className="form-input"
              placeholder="Repite la contraseña"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={submitting}
              required
            />
            <button
              type="button"
              id="toggle-activate-password"
              className="toggle-password-btn"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
        </div>

        <button
          type="submit"
          id="activate-submit"
          className="btn-primary"
          disabled={submitting}
        >
          {submitting ? <><ButtonSpinner /> Activando cuenta...</> : 'Activar cuenta'}
        </button>
      </form>
    </AuthLayout>
  );
};
