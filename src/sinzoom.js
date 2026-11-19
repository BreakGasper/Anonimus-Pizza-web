// Evita el zoom por pellizco y por doble toque en pantallas táctiles (iOS Safari ignora user-scalable=no).
export function bloquearZoomTactil() {
  if (typeof window === 'undefined' || !('ontouchstart' in window || navigator.maxTouchPoints > 0)) return
  const parar = (e) => e.preventDefault()
  document.addEventListener('gesturestart', parar)
  document.addEventListener('gesturechange', parar)
  document.addEventListener('gestureend', parar)
  document.addEventListener('touchmove', (e) => { if (e.touches.length > 1 || (e.scale && e.scale !== 1)) e.preventDefault() }, { passive: false })
  // El zoom por doble toque lo evita `touch-action: manipulation` (styles.css). Antes también se cancelaba el `touchend` de dos toques seguidos,
  // pero eso cancelaba el clic de cualquier botón tocado en menos de 320 ms tras otro toque: los botones "no respondían".
}
