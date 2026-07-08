/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare const self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// NetworkFirst for the API on Render
registerRoute(
  ({ url }) => url.hostname.endsWith('.onrender.com'),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 5,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 86_400 }),
    ],
  }),
);

// Handle autoUpdate skip-waiting message from vite-plugin-pwa
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// ── Push notifications ──────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let title = 'Weekly';
  let body  = '';
  try {
    const data = event.data.json() as { title?: string; body?: string };
    title = data.title ?? title;
    body  = data.body  ?? body;
  } catch {
    body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:     '/weekly-192.png',
      badge:    '/weekly-192.png',
      tag:      'weekly-reminder',
      renotify: true,
    }),
  );
});

// ── Notification click — focus or open the app ─────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) return (client as WindowClient).focus();
        }
        return self.clients.openWindow('/');
      }),
  );
});
