import React from 'react';
import { useNavigate } from 'react-router-dom';

export const ForbiddenPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="error-page-container">
      <div className="error-code">403</div>
      <h2 className="error-title">Acceso restringido</h2>
      <p className="error-desc">
        No tienes permisos para acceder a esta sección del sistema PotroLearn.
      </p>
      <button
        type="button"
        id="btn-forbidden-home"
        className="btn-primary"
        style={{ width: 'auto' }}
        onClick={() => navigate('/app')}
      >
        Volver al inicio
      </button>
    </div>
  );
};
