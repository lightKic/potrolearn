import React from 'react';

interface SectionLoadingProps {
  title?: string;
  className?: string;
  minHeight?: string;
  size?: 'small' | 'medium' | 'large' | string;
}

export const SectionLoading: React.FC<SectionLoadingProps> = ({
  title = 'Cargando información...',
  className = '',
  minHeight = '180px',
  size,
}) => {
  return (
    <div
      className={`section-loading-wrapper ${size ? `section-loading-${size}` : ''} ${className}`}
      style={{ minHeight }}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="section-loading-content">
        <svg width="26" height="26" viewBox="0 0 28 28" fill="none" className="spin-svg">
          <circle cx="14" cy="14" r="11" stroke="#e2e8f0" strokeWidth="3" />
          <path
            d="M14 3C7.92487 3 3 7.92487 3 14"
            stroke="#0f4c81"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
        <span className="section-loading-text">{title}</span>
      </div>
    </div>
  );
};
