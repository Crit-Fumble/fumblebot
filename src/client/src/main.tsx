import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './context';
import { App } from './App';
import './globals.css';

// Get client ID from environment or use default
const DISCORD_CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID || '1443525084256931880';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Failed to find root element');
}

createRoot(rootElement).render(
  <StrictMode>
    <AuthProvider clientId={DISCORD_CLIENT_ID}>
      <App />
    </AuthProvider>
  </StrictMode>
);
