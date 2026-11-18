// Evita el zoom por pellizco y por doble toque en pantallas táctiles (iOS Safari ignora user-scalable=no).
export function bloquearZoomTactil() {
  if (typeof window === 'undefined' || !('ontouchstart' in window || navigator.maxTouchPoints > 0)) return
  const parar = (e) => e.preventDefault()
  document.addEventListener('gesturestart', parar)
  document.addEventListener('gesturechange', parar)
  document.addEventListener('gestureend', parar)
  document.addEventListener('touchmove', (e) => { if (e.touches.length > 1 || (e.scale && e.scale !== 1)) e.preventDefault() }, { passive: false })
  let ultimo = 0
  document.addEventListener('touchend', (e) => {
    const ahora = Date.now()
    if (ahora - ultimo < 320 && e.target.closest && !e.target.closest('input, textarea, select')) e.preventDefault() // doble toque
    ultimo = ahora
  }, { passive: false })
}
