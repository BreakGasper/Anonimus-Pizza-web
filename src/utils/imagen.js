// Prepara una foto para guardarla gratis dentro de Firestore: la recorta cuadrada, la reduce y la comprime hasta que
// el texto resultante (data URL) pese poco. Así 20 fotos caben holgadas en un documento (límite de 1 MB).
export const MAX_CARACTERES = 40000 // ≈ 30 KB de imagen por foto

export class ErrorFoto extends Error { constructor(codigo) { super(codigo); this.codigo = codigo } }

async function abrir(archivo) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(archivo, { imageOrientation: 'from-image' }) } catch { /* se intenta con <img> */ }
  }
  const url = URL.createObjectURL(archivo)
  try {
    return await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => mal(new ErrorFoto('ilegible')); i.src = url })
  } finally { setTimeout(() => URL.revokeObjectURL(url), 5000) }
}

export async function prepararFoto(archivo, { lados = [400, 340, 280, 220], maxCaracteres = MAX_CARACTERES } = {}) {
  if (!archivo || !/^image\//.test(archivo.type)) throw new ErrorFoto('tipo')
  if (archivo.size > 12 * 1024 * 1024) throw new ErrorFoto('grande')
  const img = await abrir(archivo)
  const ancho = img.width || img.naturalWidth, alto = img.height || img.naturalHeight
  if (!ancho || !alto) throw new ErrorFoto('ilegible')
  const lado0 = Math.min(ancho, alto) // recorte cuadrado centrado
  const sx = (ancho - lado0) / 2, sy = (alto - lado0) / 2

  const lienzo = document.createElement('canvas')
  const formato = document.createElement('canvas').toDataURL('image/webp').startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg'
  let ultimo = ''
  for (const lado of lados) {
    lienzo.width = lienzo.height = lado
    const ctx = lienzo.getContext('2d')
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, lado, lado) // las partes transparentes quedan blancas
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, sx, sy, lado0, lado0, 0, 0, lado, lado)
    for (const q of [0.82, 0.72, 0.62, 0.52, 0.42, 0.34]) {
      ultimo = lienzo.toDataURL(formato, q)
      if (ultimo.length <= maxCaracteres) return ultimo
    }
  }
  throw new ErrorFoto('pesada')
}
