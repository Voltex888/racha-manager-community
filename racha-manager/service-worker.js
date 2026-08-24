const CACHE_NAME='racha-manager-community-v1';
const APP_SHELL=['./','./index.html','./manifest.webmanifest','./assets/icon-192.png','./assets/icon-512.png','./assets/apple-touch-icon.png','./css/00-foundation.css','./css/05-multi-tenant.css','./css/10-elenco.css','./css/20-rodadas.css','./css/30-rankings-recordes.css','./css/40-podio-mes.css','./css/50-perfil-titulos.css','./css/60-patentes-temas.css','./css/99-mobile-card-proportion.css','./vendor/firebase/firebase-app-compat.js','./vendor/firebase/firebase-firestore-compat.js','./vendor/firebase/firebase-auth-compat.js','./vendor/firebase/firebase-storage-compat.js','./js/services/firebase-adapter.js','./js/core/app-state.js','./js/features/auth-data.js','./js/features/multi-tenant.js','./js/ui/navigation-music.js','./js/features/players.js','./js/features/rounds.js','./js/core/attendance-final-sync.js','./js/features/rankings-trophies.js','./js/features/records.js','./js/features/months-profile.js','./js/features/backgrounds.js','./js/core/loading-guard.js','./js/core/pwa-install.js'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put('./index.html',copy));return response}).catch(()=>caches.match('./index.html')));
    return;
  }
  if(event.request.destination==='script'||event.request.destination==='style'){
    event.respondWith(fetch(event.request).then(response=>{if(response.ok&&new URL(event.request.url).origin===location.origin){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy))}return response}).catch(()=>caches.match(event.request)));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{if(response.ok&&new URL(event.request.url).origin===location.origin){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy))}return response})));
});
