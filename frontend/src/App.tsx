import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext.js';
import { AppRoutes } from './routes/index.js';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
