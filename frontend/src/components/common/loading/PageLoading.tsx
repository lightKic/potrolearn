import React from 'react';

interface PageLoadingProps {
  title?: string;
  description?: string;
  className?: string;
  minHeight?: string;
}

export const PageLoading: React.FC<PageLoadingProps> = ({
  title = 'Cargando...',
  description,
  className = '',
  minHeight = '60vh',
}) => {
  return (
    <div
      className={`page-loading-wrapper ${className}`}
      style={{ minHeight }}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="page-loading-content">
        <div className="page-loading-spinner-ring">
          <svg width="44" height="44" viewBox="0 0 48 48" fill="none" className="spin-svg">
            <circle cx="24" cy="24" r="20" stroke="#e2e8f0" strokeWidth="4" />
            <path
              d="M24 4C12.9543 4 4 12.9543 4 24"
              stroke="#0f4c81"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <h3 className="page-loading-title">{title}</h3>
        {description && <p className="page-loading-description">{description}</p>}
      </div>
    </div>
  );
};
