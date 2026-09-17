import React, { ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
  subtitle?: string;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children, subtitle }) => {
  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-brand">PotroLearn</div>
          {subtitle && <p className="auth-subtitle">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
};
