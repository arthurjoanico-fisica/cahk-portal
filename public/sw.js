const CACHE='cahk-v613-noticias-route-fix';
const CORE=['/','/portal-v5.css?v=6.1.2','/portal-v5.js?v=6.1.2','/assets/cahk-logo-v32.png','/assets/favicon-192.png','/biblioteca/','/grade/','/disciplina/','/minha-fisica/','/projetos/','/vida-campus/','/agenda/','/noticias/','/transparencia/','/instalar/','/painel/','/qrcode/','/pwa.js?v=6.1.2'];

self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await Promise.allSettled(CORE.map(async url=>{
      try{
        const response=await fetch(url,{cache:'reload'});
        if(response&&response.ok) await cache.put(url,response.clone());
      }catch(_){ }
    }));
  })());
});

self.addEventListener('activate',e=>e.waitUntil((async()=>{
  for(const k of await caches.keys()){
    if(k!==CACHE) await caches.delete(k);
  }
  await self.clients.claim();
})()));

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  const u=new URL(e.request.url);
  if(u.origin!==location.origin) return;
  e.respondWith(
    fetch(e.request).then(r=>{
      if(r&&r.ok){
        const copy=r.clone();
        caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{});
      }
      return r;
    }).catch(()=>caches.match(e.request).then(r=>r||caches.match('/')))
  );
});
