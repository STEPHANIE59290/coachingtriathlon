// Service worker de Mon Coach Half : usage hors ligne SANS jamais figer une ancienne version.
// Ce fichier ne change plus d'une version à l'autre : seul index.html est remplacé à chaque mise à jour.
// Pages : réseau d'abord (toujours la dernière version), cache seulement en secours (hors ligne ou réseau lent).
const CACHE = 'mon-coach-half-cache';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './apple-touch-icon.png', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('mon-coach-half-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // intervals.icu et tout service externe : jamais interceptés
  if (url.searchParams.has('chk') || req.headers.has('range')) return; // vérification de version : toujours directe

  // config.js (adresse et clé publique du compte en ligne) : réseau d'abord, copie en secours hors ligne
  if (url.pathname.endsWith('/config.js')) {
    e.respondWith(fetch(req.url, { cache: 'no-store' }).then(r => {
      if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
      return r;
    }).catch(() => caches.match(req)));
    return;
  }

  if (req.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/')) {
    e.respondWith((async () => {
      const net = fetch(req.url, { cache: 'no-store' }).then(r => {
        if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put('./index.html', cp)); }
        return r;
      });
      net.catch(() => {});
      try {
        return await Promise.race([net, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000))]);
      } catch (err) {
        const cached = await caches.match('./index.html');
        return cached || net;
      }
    })());
    return;
  }

  // fichiers statiques (icônes, manifest) : cache d'abord
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
    return r;
  })));
});
