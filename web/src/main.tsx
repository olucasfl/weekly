import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { configureApi } from './lib/api';
import { useAuthStore } from './store/auth';
import { initTheme } from './store/theme';
import './index.css';

initTheme();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

configureApi(
  () => useAuthStore.getState().token,
  () => {
    useAuthStore.getState().clearSession();
    queryClient.clear();
  },
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
