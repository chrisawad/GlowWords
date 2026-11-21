// Build-time placeholders are filled from the actual production output.
const scope = self.registration.scope;
const prefix = 'glowwords:' + scope + ':';
const cacheName = prefix + '__REVISION__';
const shell = new URL('./', scope).href;
const urls = new Set(__FILES__.map(file => new URL(file, scope).href));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache =>
    cache.addAll([...urls].map(url => new Request(url, { cache: 'reload' })))
  ));
});

// Leave the current puzzle and its assets together until all old tabs close.
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(prefix) && name !== cacheName) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  let key = url.href;
  if (request.mode === 'navigate') {
    const entry = new URL(url);
    entry.search = '';
    entry.hash = '';
    if (entry.href !== shell && entry.href !== new URL('index.html', scope).href) return;
    key = shell;
  }
  if (urls.has(key)) {
    event.respondWith(caches.open(cacheName).then(async cache => (await cache.match(key)) ?? fetch(request)));
  }
});
