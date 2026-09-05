/* Build replaces the following two placeholders. App data lives only in IndexedDB. */
const VERSION = "feder-6d914cba7d6b";
const ASSETS = ["./favicon.svg","./icon-192.png","./icon-512.png","./index.html","./manifest.webmanifest","./thesaurus.json","./assets/entities.worker-D-RZ1g9h.js","./assets/index-BR7CwK5p.js","./assets/index-Ctgad66W.css","./assets/publishing-DwstQLE1.js","./assets/thesaurus.worker-DOSuw8dC.js"];
const PREFIX = 'feder:' + self.registration.scope + ':';
const CACHE = PREFIX + VERSION;
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
// Previous caches are intentionally retained: older windows may still need their lazy chunks.
self.addEventListener('message',event=>{
 if(event.data?.type!=='ACTIVATE_SAFELY')return;
 event.waitUntil((async()=>{
  const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const scoped=clients.filter(c=>c.url.startsWith(self.registration.scope));
  if(scoped.length!==1||scoped[0].id!==event.source?.id){event.ports[0]?.postMessage({ok:false,error:'Bitte schließe alle anderen Feder-Fenster (auch die Homescreen-App) und versuche es erneut. Deine Daten bleiben unverändert.'});return;}
  event.ports[0]?.postMessage({ok:true});await self.skipWaiting();
 })());
});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
 event.respondWith(caches.open(CACHE).then(async cache=>{
  const hit=await cache.match(event.request);if(hit)return hit;
  // Hashed chunks belonging to an older client can still be served from its former cache.
  if(new URL(event.request.url).pathname.includes('/assets/')){const old=await caches.match(event.request);if(old)return old;}
  try{return await fetch(event.request);}catch(error){if(event.request.mode==='navigate')return await cache.match('./index.html');throw error;}
 }));
});
