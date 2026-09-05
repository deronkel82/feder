import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const dir = 'dist-pages';
const files = readdirSync(dir, { recursive: true })
  .filter(
    (f) =>
      !f.endsWith('sw.js') &&
      !f.includes('LICENSE') &&
      /\.(html|js|css|json|png|svg|webmanifest)$/.test(f),
  )
  .map((f) => './' + f);
const hash = createHash('sha256');
for (const f of files) hash.update(readFileSync(dir + '/' + f));
const version = 'feder-' + hash.digest('hex').slice(0, 12);
writeFileSync(
  dir + '/sw.js',
  `const PREFIX='feder:'+self.registration.scope+':';const CACHE=PREFIX+${JSON.stringify(version)};const ASSETS=${JSON.stringify(files)};self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;e.respondWith(caches.open(CACHE).then(async c=>{const hit=await c.match(e.request);if(hit)return hit;try{return await fetch(e.request);}catch(err){if(e.request.mode==='navigate')return await c.match('./index.html');throw err;}}));});`,
);
console.log('Offline shell:', files.length, 'files;', version);
