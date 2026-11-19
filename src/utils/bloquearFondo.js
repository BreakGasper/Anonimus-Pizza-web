import { watch, onUnmounted } from 'vue'

// Mientras hay un diálogo abierto, la página de atrás no se desplaza (así al deslizar sobre el diálogo se mueve el diálogo, no el fondo).
// Se fija el <body> en su posición actual (funciona también en iOS Safari) y se restaura al cerrar.
let abiertos = 0, y0 = 0
function bloquear() {
  if (abiertos++ > 0) return
  y0 = window.scrollY
  const s = document.body.style
  s.position = 'fixed'; s.top = `-${y0}px`; s.left = '0'; s.right = '0'; s.width = '100%'
}
function liberar() {
  if (--abiertos > 0) return
  abiertos = 0
  const s = document.body.style
  s.position = ''; s.top = ''; s.left = ''; s.right = ''; s.width = ''
  window.scrollTo(0, y0)
}
// abierto: ref/getter que es verdadero mientras el diálogo está a la vista.
export function bloquearFondo(abierto) {
  let activo = false
  const poner = (v) => { if (v && !activo) { activo = true; bloquear() } else if (!v && activo) { activo = false; liberar() } }
  watch(abierto, (v) => poner(!!v), { immediate: true, flush: 'sync' })
  onUnmounted(() => poner(false))
}
