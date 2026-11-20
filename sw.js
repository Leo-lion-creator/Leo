/* Service Worker: offline-fähig + Empfang von geteilten Chats (Android „Teilen“) */
const CACHE = 'geschenke-v1';
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'detector.js', 'manifest.webmanifest', 'icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== 'share-inbox').map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  if (e.request.method === 'POST' && url.pathname.endsWith('/share-target')) {
    e.respondWith((async () => {
      const form = await e.request.formData();
      const inbox = await caches.open('share-inbox');
      const text = [form.get('title'), form.get('text'), form.get('url')].filter(Boolean).join('\n');
      if (text) await inbox.put('text', new Response(text));
      const file = form.get('file');
      if (file && typeof file !== 'string') {
        await inbox.put('file', new Response(file, { headers: { 'x-file-name': encodeURIComponent(file.name || 'chat.txt') } }));
      }
      return Response.redirect('./?shared=1', 303);
    })());
    return;
  }

  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Netzwerk zuerst (für Updates), sonst Cache
  e.respondWith(
    fetch(e.request)
      .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
  );
});
