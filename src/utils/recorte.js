// Prepara la foto de un ingrediente: le quita el fondo (queda transparente), recorta el sobrante y la reduce para guardarla
// en Firestore. Todo ocurre en el navegador. Funciona mejor con fondo liso (blanco o de un solo color); si la imagen ya
// trae transparencia (PNG/WebP sin fondo) se respeta tal cual.
export const MAX_CARACTERES_ING = 28000 // por imagen; 24 imágenes caben bajo el límite de 1 MB del documento
const LADO_TRABAJO = 480
const LADOS_SALIDA = [256, 208, 168, 136, 108, 88]

export class ErrorImagenIng extends Error {}

function cargar(archivo) {
  return new Promise((ok, mal) => {
    if (!/^image\//.test(archivo?.type || '')) return mal(new ErrorImagenIng('Elige un archivo de imagen.'))
    const url = URL.createObjectURL(archivo)
    const im = new Image()
    im.onload = () => { URL.revokeObjectURL(url); ok(im) }
    im.onerror = () => { URL.revokeObjectURL(url); mal(new ErrorImagenIng('No se pudo leer la imagen.')) }
    im.src = url
  })
}

// Lee el archivo y lo deja en un tamaño de trabajo (ImageData con el píxel original, con su transparencia si la trae).
export async function leerFuente(archivo) {
  const im = await cargar(archivo)
  const r = Math.min(1, LADO_TRABAJO / Math.max(im.naturalWidth, im.naturalHeight))
  const w = Math.max(1, Math.round(im.naturalWidth * r)), h = Math.max(1, Math.round(im.naturalHeight * r))
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(im, 0, 0, w, h)
  return ctx.getImageData(0, 0, w, h)
}

const alfa = (d, x, y) => d.data[(y * d.width + x) * 4 + 3]

// ¿Ya viene con fondo transparente? (esquinas transparentes o buena parte de la imagen transparente)
export function tieneTransparencia(d) {
  const esq = [alfa(d, 0, 0), alfa(d, d.width - 1, 0), alfa(d, 0, d.height - 1), alfa(d, d.width - 1, d.height - 1)]
  if (esq.filter((a) => a < 40).length >= 3) return true
  let t = 0; for (let i = 3; i < d.data.length; i += 4) if (d.data[i] < 40) t++
  return t / (d.data.length / 4) > 0.04
}

// Color del fondo: el más frecuente en el borde de la imagen. `uniforme` dice qué tan parejo es.
function colorDeFondo(d) {
  const { width: W, height: H, data } = d
  const cubos = new Map(); let total = 0
  const tomar = (x, y) => {
    const i = (y * W + x) * 4, k = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4)
    const c = cubos.get(k) || { n: 0, r: 0, g: 0, b: 0 }
    c.n++; c.r += data[i]; c.g += data[i + 1]; c.b += data[i + 2]; cubos.set(k, c); total++
  }
  for (let x = 0; x < W; x++) { tomar(x, 0); tomar(x, H - 1) }
  for (let y = 1; y < H - 1; y++) { tomar(0, y); tomar(W - 1, y) }
  let mejor = null
  for (const c of cubos.values()) if (!mejor || c.n > mejor.n) mejor = c
  return { r: mejor.r / mejor.n, g: mejor.g / mejor.n, b: mejor.b / mejor.n, uniforme: mejor.n / total }
}

/* Quita el fondo: parte del borde y avanza por los píxeles parecidos al color de fondo (los que no están conectados al borde,
   como el interior del ingrediente, no se tocan). `sensibilidad` 0–100: más alto quita más tonos parecidos. */
export function quitarFondo(fuente, sensibilidad = 25) {
  const { width: W, height: H } = fuente
  const out = new ImageData(new Uint8ClampedArray(fuente.data), W, H)
  const d = out.data
  const f = colorDeFondo(fuente)
  const T = 20 + sensibilidad * 2.2
  const dist = (i) => Math.hypot(d[i] - f.r, d[i + 1] - f.g, d[i + 2] - f.b)
  const quitado = new Uint8Array(W * H)
  const pila = []
  const empujar = (x, y) => {
    const p = y * W + x
    if (quitado[p]) return
    const i = p * 4
    if (d[i + 3] < 40 || dist(i) <= T) { quitado[p] = 1; pila.push(p) }
  }
  for (let x = 0; x < W; x++) { empujar(x, 0); empujar(x, H - 1) }
  for (let y = 0; y < H; y++) { empujar(0, y); empujar(W - 1, y) }
  while (pila.length) {
    const p = pila.pop(), x = p % W, y = (p / W) | 0
    if (x > 0) empujar(x - 1, y)
    if (x < W - 1) empujar(x + 1, y)
    if (y > 0) empujar(x, y - 1)
    if (y < H - 1) empujar(x, y + 1)
  }
  // Borde suave: los píxeles junto al fondo quitado se vuelven semitransparentes según qué tan lejos están del color de fondo.
  const sale = new Uint8Array(W * H)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = y * W + x
    if (quitado[p]) continue
    const cerca = (x > 0 && quitado[p - 1]) || (x < W - 1 && quitado[p + 1]) || (y > 0 && quitado[p - W]) || (y < H - 1 && quitado[p + W])
    if (!cerca) continue
    const t = Math.min(1, Math.max(0, (dist(p * 4) - T) / (T * 0.35)))
    d[p * 4 + 3] = Math.round(d[p * 4 + 3] * t * t * (3 - 2 * t))
    if (d[p * 4 + 3] < 8) sale[p] = 1
  }
  for (let p = 0; p < W * H; p++) if (quitado[p] || sale[p]) d[p * 4 + 3] = 0
  out.uniforme = f.uniforme
  return out
}

// Recorta lo transparente sobrante y exporta (WebP con transparencia) bajo el límite de caracteres.
export function exportar(datos) {
  const { width: W, height: H, data } = datos
  let x0 = W, y0 = H, x1 = -1, y1 = -1
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  if (x1 < 0) throw new ErrorImagenIng('No quedó nada de la imagen al quitar el fondo. Baja la sensibilidad o usa otra foto.')
  const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.03)
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(W - 1, x1 + pad); y1 = Math.min(H - 1, y1 + pad)
  const w = x1 - x0 + 1, h = y1 - y0 + 1
  const origen = document.createElement('canvas'); origen.width = W; origen.height = H
  origen.getContext('2d').putImageData(datos, 0, 0)
  for (const lado of LADOS_SALIDA) {
    const r = Math.min(1, lado / Math.max(w, h))
    const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(w * r)); cv.height = Math.max(1, Math.round(h * r))
    const ctx = cv.getContext('2d'); ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(origen, x0, y0, w, h, 0, 0, cv.width, cv.height)
    const url = cv.toDataURL('image/webp', 0.84)
    if (url.length <= MAX_CARACTERES_ING) return { url, ancho: cv.width, alto: cv.height }
  }
  throw new ErrorImagenIng('La imagen es demasiado pesada. Prueba con otra foto más sencilla.')
}

// Todo junto: de la fuente (ImageData) al resultado final con el fondo transparente.
export function procesar(fuente, quitar, sensibilidad) {
  const datos = quitar ? quitarFondo(fuente, sensibilidad) : fuente
  const r = exportar(datos)
  r.fondoPocoUniforme = quitar && datos.uniforme < 0.5
  return r
}
