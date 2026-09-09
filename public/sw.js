/* Minimal offline shell. Operational data always remains online/Supabase-backed. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
