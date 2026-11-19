import { createApp } from 'vue'
import App from './App.vue'
import router from './router.js'
import { bloquearZoomTactil } from './sinzoom.js'
import { cargarMenu } from './store/menu.js'
import './styles.css'

// Tras una publicación nueva, una pestaña o un index.html guardados en el dispositivo pueden pedir archivos que ya no existen:
// la navegación fallaba en silencio y los botones parecían muertos hasta refrescar. Se recarga una sola vez con la versión nueva.
function recargarUnaVez(destino) {
  try {
    if (Date.now() - Number(sessionStorage.getItem('anonimus-recarga') || 0) < 15000) return
    sessionStorage.setItem('anonimus-recarga', String(Date.now()))
  } catch { /* sin almacenamiento: se intenta igual una vez */ }
  const ir = () => (destino && destino !== location.pathname + location.search ? location.assign(destino) : location.reload())
  fetch(location.pathname, { cache: 'reload' }).then(ir, ir) // refresca la copia guardada del index.html antes de recargar
}
const esErrorDeArchivo = (e) => /dynamically imported module|Importing a module script|Unable to preload|Loading chunk|Failed to fetch/i.test(String(e?.message || e))
window.addEventListener('vite:preloadError', (ev) => { ev.preventDefault(); recargarUnaVez() })
router.onError((err, to) => { if (esErrorDeArchivo(err)) recargarUnaVez(to?.fullPath) })

bloquearZoomTactil()
cargarMenu() // lee el menú guardado (1 lectura); mientras tanto se usa el último visto o el menú inicial
createApp(App).use(router).mount('#app')
