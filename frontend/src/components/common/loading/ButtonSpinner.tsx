import React from 'react';

interface ButtonSpinnerProps {
  size?: number;
  color?: string;
  className?: string;
}

export const ButtonSpinner: React.FC<ButtonSpinnerProps> = ({
  size = 16,
  color = 'currentColor',
  className = '',
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={`spin-svg button-spinner-icon ${className}`}
      style={{ flexShrink: 0, display: 'inline-block', verticalAlign: 'middle' }}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
      <path
        d="M12 3C7.02944 3 3 7.02944 3 12"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
};
