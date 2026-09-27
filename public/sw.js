const CACHE='cahk-v610-academic-hub';
const CORE=['/','/portal-v5.css?v=6.1.0','/portal-v5.js?v=6.1.0','/assets/cahk-logo-v32.png','/assets/favicon-192.png','/biblioteca/','/grade/','/disciplina/','/minha-fisica/','/projetos/','/vida-campus/','/agenda/','/transparencia/','/instalar/','/painel/','/qrcode/','/pwa.js?v=6.1.0'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).catch(()=>{}));});
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys()){if(k!==CACHE)await caches.delete(k);}await self.clients.claim();})()));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const u=new URL(e.request.url);if(u.origin!==location.origin)return;e.respondWith(fetch(e.request).then(r=>{if(r&&r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{});}return r;}).catch(()=>caches.match(e.request).then(r=>r||caches.match('/'))));});
