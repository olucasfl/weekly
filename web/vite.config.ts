import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['weekly-180.png', 'weekly-192.png', 'weekly-512.png'],
      manifest: {
        name: 'Rotina Weekly Planner',
        short_name: 'Rotina',
        description: 'Planejamento semanal com estilo Claude',
        theme_color: '#f8f2ff',
        background_color: '#fffdf8',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'weekly-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'weekly-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
  },
});
