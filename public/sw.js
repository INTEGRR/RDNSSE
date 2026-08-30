/* Trödelradar Service Worker: App-Shell offline, Karten-Kacheln gecacht. */
const SHELL = 'shell-v1'
const TILES = 'tiles-v1'
const TILE_LIMIT = 300

self.addEventListener('install', e => {
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== SHELL && k !== TILES).map(k => caches.delete(k))),
    ).then(() => self.clients.claim()),
  )
})

async function trimCache(name, limit) {
  const cache = await caches.open(name)
  const keys = await cache.keys()
  if (keys.length > limit) {
    await cache.delete(keys[0])
    return trimCache(name, limit)
  }
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET') return

  // OSM-Kacheln: cache-first mit Limit (offline weiterlaufen, wo man schon war)
  if (url.hostname.endsWith('tile.openstreetmap.org')) {
    e.respondWith(
      caches.open(TILES).then(async cache => {
        const hit = await cache.match(e.request)
        if (hit) return hit
        const res = await fetch(e.request)
        if (res.ok) {
          cache.put(e.request, res.clone())
          trimCache(TILES, TILE_LIMIT)
        }
        return res
      }),
    )
    return
  }

  if (url.origin !== location.origin) return

  // Standdaten: network-first (frisch, wenn möglich), Cache als Fallback
  if (url.pathname === '/stands.json') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const copy = res.clone()
          caches.open(SHELL).then(c => c.put(e.request, copy))
          return res
        })
        .catch(() => caches.match(e.request)),
    )
    return
  }

  // App-Shell & Assets: stale-while-revalidate
  e.respondWith(
    caches.open(SHELL).then(async cache => {
      const hit = await cache.match(e.request)
      const refresh = fetch(e.request)
        .then(res => {
          if (res.ok) cache.put(e.request, res.clone())
          return res
        })
        .catch(() => hit)
      return hit || refresh
    }),
  )
})
