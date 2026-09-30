import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { AppProviders } from '@/app/providers';
import { AuthProvider } from '@/features/auth/auth-provider';
import { router } from '@/routes/router';
import '@/styles/globals.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error(
    'Root element #root was not found. Check that index.html contains <div id="root"></div>.',
  );
}

createRoot(container).render(
  <StrictMode>
    <AppProviders>
      {/* Inside the providers so the token accessors reach the configured client. */}
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </AppProviders>
  </StrictMode>,
);
