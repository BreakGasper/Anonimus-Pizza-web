// Service worker del panel: solo muestra avisos y abre el pedido al tocarlos. No guarda nada en caché.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const id = e.notification.data && e.notification.data.id
  const destino = '/admin' + (id ? '?pedido=' + encodeURIComponent(id) : '')
  e.waitUntil((async () => {
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const abierta = ventanas.find((c) => new URL(c.url).pathname.startsWith('/admin')) || ventanas[0]
    if (abierta) {
      if (id) abierta.postMessage({ tipo: 'abrir-pedido', id })
      return abierta.focus()
    }
    return self.clients.openWindow(destino)
  })())
})
