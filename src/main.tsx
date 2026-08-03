import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './hooks/AuthContext';
import { ExpensesProvider } from './hooks/ExpensesContext';
import { ThemeProvider } from './theme/ThemeContext';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import './index.css';
import App from './App.tsx';
import { registerSW } from 'virtual:pwa-register';
import { watchForUpdates } from './services/swUpdates';

// A new version activates silently; see watchForUpdates for when we look.
registerSW({
  onRegisteredSW(_url, registration) {
    if (registration) watchForUpdates(registration);
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <ExpensesProvider>
          <ThemeProvider>
            <App />
          </ThemeProvider>
        </ExpensesProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
