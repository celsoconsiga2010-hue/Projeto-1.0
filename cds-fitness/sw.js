/* Service worker do CDS Fitness.
   - Guarda o app no aparelho para abrir sem internet.
   - Arquivos do próprio app: tenta a rede primeiro (sempre a versão mais nova) e cai no cache se estiver offline ou lento.
   - Biblioteca do Supabase e fontes: usa o cache e atualiza em segundo plano.
   - Chamadas ao Supabase (dados e login) nunca passam por aqui.
   Ao publicar uma versão nova, troque VERSION. */
const VERSION = 'cds-fitness-v2';
const CORE = ['./', 'index.html', 'css/app.css', 'js/theme.js', 'js/config.js', 'js/util.js', 'js/api.js', 'js/views.js', 'js/screens.js', 'js/cycles.js', 'js/app.js',
  'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
const CDN = ['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js'];
const CACHE_HOSTS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(CORE);
    await Promise.all(CDN.map(u => c.add(new Request(u, { mode: 'cors' })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req, { ignoreSearch: true });
  try {
    const net = fetch(req);
    const res = hit ? await Promise.race([net, new Promise((_, rej) => setTimeout(() => rej(new Error('lento')), 4000))]) : await net;
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    if (hit) return hit;
    if (req.mode === 'navigate') return (await cache.match('index.html')) || (await cache.match('./')) || Response.error();
    return Response.error();
  }
}

async function cacheThenUpdate(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  const update = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => null);
  return hit || (await update) || Response.error();
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) { e.respondWith(networkFirst(req)); return; }
  if (CACHE_HOSTS.includes(url.hostname)) { e.respondWith(cacheThenUpdate(req)); return; }
  /* qualquer outra origem (Supabase) vai direto para a rede */
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(list => (list[0] ? list[0].focus() : self.clients.openWindow('./'))));
});
