import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../dist/client/', import.meta.url),
  assets = await readdir(new URL('assets/', root));
const paths = [
  '/offline/',
  '/offline/index.html',
  ...assets
    .filter((name) => /\.(?:js|css|woff2?)$/.test(name))
    .sort()
    .map((name) => `/assets/${name}`),
];
const html = await readFile(new URL('offline/index.html', root));
const version = createHash('sha256').update(JSON.stringify(paths)).update(html).digest('hex').slice(0, 20);
const source = `const CACHE='worth-offline-shell-${version}';const PATHS=${JSON.stringify(paths)};const allowed=new Set(PATHS);self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.addAll(PATHS);await self.skipWaiting();})()));self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith('worth-offline-shell-')&&name!==CACHE)await caches.delete(name);await self.clients.claim();})()));self.addEventListener('message',event=>{if(event.data?.type==='PREPARE')event.waitUntil((async()=>{try{const cache=await caches.open(CACHE);await cache.addAll(PATHS);event.ports[0]?.postMessage({ok:true});}catch{event.ports[0]?.postMessage({ok:false});}})());});self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||(url.search&&event.request.mode!=='navigate')||!allowed.has(url.pathname))return;event.respondWith((async()=>{const cache=await caches.open(CACHE);const response=await cache.match(url.pathname);return response||fetch(event.request);})());});`;
await writeFile(new URL('offline/sw.js', root), source);
