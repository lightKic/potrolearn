import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth.js';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();
  const { status } = useAuth();

  const handleHomeClick = () => {
    if (status === 'authenticated') {
      navigate('/app');
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="error-page-container">
      <div className="error-code">404</div>
      <h2 className="error-title">Página no encontrada</h2>
      <p className="error-desc">
        La dirección solicitada no existe o ha sido movida dentro de PotroLearn.
      </p>
      <button
        type="button"
        id="btn-notfound-home"
        className="btn-primary"
        style={{ width: 'auto' }}
        onClick={handleHomeClick}
      >
        Volver al inicio
      </button>
    </div>
  );
};
