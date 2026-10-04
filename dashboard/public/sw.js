// Minimal service worker whose only job is to satisfy the browser's PWA
// installability criteria (manifest + an active service worker) so a
// restaurant's public menu page can offer Android's "Add to Home Screen" /
// install prompt — see InstallAppPrompt.tsx. It deliberately does no
// caching: every fetch is left to the network exactly as if this worker
// didn't exist, so it can never serve stale content.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
