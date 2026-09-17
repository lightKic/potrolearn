import React from 'react';
import { Header } from '../components/Header.js';

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header />
      <main style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem',
      }}>
        {children}
      </main>
      <footer style={{
        padding: '1.5rem',
        textAlign: 'center',
        borderTop: '1px solid var(--border-color)',
        color: 'var(--text-muted)',
        fontSize: '0.875rem',
      }}>
        &copy; {new Date().getFullYear()} PotroLearn - Plataforma Educativa
      </footer>
    </div>
  );
};
