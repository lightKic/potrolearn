import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth.js';
import { AuthLayout } from '../layouts/AuthLayout.js';
import { ApiError } from '../services/api.js';
import { ButtonSpinner } from '../components/common/loading/index.js';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Por favor introduce tu correo y contraseña.');
      return;
    }

    setLoading(true);
    try {
      const loggedUser = await login(email.trim(), password);
      if (loggedUser.mustChangePassword) {
        navigate('/change-password', { replace: true });
      } else {
        navigate('/app', { replace: true });
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'INVALID_CREDENTIALS') {
          setErrorMessage('Correo o contraseña incorrectos.');
        } else if (err.code === 'ACCOUNT_SUSPENDED') {
          setErrorMessage('Tu cuenta no se encuentra disponible.');
        } else {
          setErrorMessage(err.message);
        }
      } else {
        setErrorMessage('No fue posible conectar con PotroLearn. Inténtalo nuevamente en unos momentos.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout subtitle="Ingresa tus credenciales para acceder a la plataforma">
      {errorMessage && (
        <div className="alert alert-danger" role="alert" id="login-error-alert">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} id="login-form">
        <div className="form-group">
          <label className="form-label" htmlFor="login-email">
            Correo electrónico
          </label>
          <input
            id="login-email"
            type="email"
            className="form-input"
            placeholder="usuario@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            required
            autoComplete="email"
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="login-password">
            Contraseña
          </label>
          <div className="input-wrapper">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              className="form-input"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              id="toggle-password"
              className="toggle-password-btn"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
        </div>

        <button
          type="submit"
          id="login-submit"
          className="btn-primary"
          disabled={loading}
        >
          {loading ? <><ButtonSpinner /> Iniciando sesión...</> : 'Iniciar sesión'}
        </button>
      </form>
    </AuthLayout>
  );
};
