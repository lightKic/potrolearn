import React from 'react';

export const Header: React.FC = () => {
  return (
    <header style={{
      padding: '1.5rem 2rem',
      borderBottom: '1px solid var(--border-color)',
      background: 'var(--bg-card)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, var(--primary), var(--accent))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          fontWeight: 800,
          fontFamily: 'var(--font-heading)',
          fontSize: '1.2rem',
        }}>
          P
        </div>
        <span style={{
          fontFamily: 'var(--font-heading)',
          fontWeight: 700,
          fontSize: '1.25rem',
          letterSpacing: '-0.01em',
        }}>
          PotroLearn
        </span>
      </div>
      <div className="badge" style={{ margin: 0 }}>
        <span className="status-dot"></span>
        v1.0.0 Monorepo Init
      </div>
    </header>
  );
};
