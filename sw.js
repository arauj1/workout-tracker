// sw.js - IronLog Service Worker for 100% Offline Gym Operation
const CACHE_NAME = 'ironlog-v1';

const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './styles.css',
    './db.js',
    './audio.js',
    './timer.js',
    './app.js',
    './manifest.json',
    './icons/icon.svg',
    './icons/icon-192.png',
    './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    // Stale-while-revalidate strategy for seamless offline availability
    e.respondWith(
        caches.match(e.request).then((cachedResponse) => {
            const fetchPromise = fetch(e.request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200 && e.request.method === 'GET') {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(e.request, responseClone);
                        });
                    }
                    return networkResponse;
                })
                .catch(() => cachedResponse); // If network fails (e.g. offline at the gym), return cached

            return cachedResponse || fetchPromise;
        })
    );
});
