import { ref, computed } from 'vue'
import { MENU_INICIAL, precioPorTamano } from '../data/menu.js'
import { imgEspecialidad, imgCalzone, imgBase } from '../data/imagenes.js'
import { firebaseConfig } from '../firebase/claves.js'

// ---------- Normalización: el menú guardado puede traer campos faltantes ----------
export function normalizar(it) {
  const n = (v) => (typeof v === 'number' && isFinite(v) ? v : Number(v) || 0)
  return {
    id: String(it.id || ''), tipo: ['especialidad', 'paquete', 'adicional'].includes(it.tipo) ? it.tipo : 'adicional',
    categoria: String(it.categoria || ''), nombre: String(it.nombre || '').slice(0, 80), desc: String(it.desc || '').slice(0, 220),
    precio: n(it.precio), precioPromo: it.precioPromo == null || it.precioPromo === '' ? null : n(it.precioPromo), enPromo: !!it.enPromo,
    favorita: !!it.favorita, activo: it.activo !== false, emoji: String(it.emoji || ''), foto: String(it.foto || ''),
    ingredientes: Array.isArray(it.ingredientes) ? it.ingredientes.map(String) : [],
  }
}

// ---------- Estado: menú guardado (si existe) o el inicial ----------
const CACHE = 'anonimus-menu-cache-v1'
function leerCache() {
  try { const v = JSON.parse(localStorage.getItem(CACHE)); return Array.isArray(v) ? v : null } catch { return null }
}
export const items = ref((leerCache() || MENU_INICIAL).map(normalizar))
export const cargado = ref(false)

// Fotos subidas desde el panel: { idFoto: 'data:image/webp;base64,…' }. Se descargan solo cuando cambian (versión) y se guardan en el dispositivo.
const CACHE_FOTOS = 'anonimus-fotos-cache-v1'
function leerCacheFotos() {
  try { const v = JSON.parse(localStorage.getItem(CACHE_FOTOS)); return v && typeof v.fotos === 'object' && v.fotos ? v : { version: 0, fotos: {} } } catch { return { version: 0, fotos: {} } }
}
export const fotosSubidas = ref(leerCacheFotos().fotos)

// Firestore por REST (un solo documento, sin cargar el SDK en la tienda). El menú es de lectura pública.
function valor(v) {
  if ('stringValue' in v) return v.stringValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return v.doubleValue
  if ('booleanValue' in v) return v.booleanValue
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(valor)
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, valor(x)]))
  return null
}
const origen = () => (import.meta.env.VITE_EMULATOR === '1' ? 'http://127.0.0.1:8080' : 'https://firestore.googleapis.com')

async function sincronizarFotos(version) {
  if (!version) { fotosSubidas.value = {}; try { localStorage.removeItem(CACHE_FOTOS) } catch { /* sin almacenamiento */ } return }
  const cache = leerCacheFotos()
  if (cache.version === version) { fotosSubidas.value = cache.fotos; return } // sin cambios: no se descarga nada
  try {
    const r = await fetch(`${origen()}/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/config/fotos?key=${firebaseConfig.apiKey}`)
    if (!r.ok) return
    const doc = await r.json()
    const fotos = doc.fields?.fotos ? valor(doc.fields.fotos) : {}
    fotosSubidas.value = fotos || {}
    try { localStorage.setItem(CACHE_FOTOS, JSON.stringify({ version, fotos: fotosSubidas.value })) } catch { /* sin almacenamiento */ }
  } catch { /* sin conexión: se quedan las que ya había */ }
}

export async function cargarMenu() {
  try {
    // Se pide la lista de la colección `config` (responde 200 aunque no exista el menú; un `get` daría 404 y ensucia la consola).
    // La máscara trae solo los productos y la versión de las fotos, no las fotos mismas.
    const r = await fetch(`${origen()}/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/config?pageSize=20&mask.fieldPaths=items&mask.fieldPaths=fotosVersion&key=${firebaseConfig.apiKey}`)
    if (r.ok) {
      const lista = ((await r.json()).documents || []).find((d) => d.name.endsWith('/config/menu'))
      const guardados = lista?.fields?.items ? valor(lista.fields.items) : null
      if (Array.isArray(guardados)) {
        items.value = guardados.map(normalizar)
        try { localStorage.setItem(CACHE, JSON.stringify(guardados)) } catch { /* sin almacenamiento */ }
        await sincronizarFotos(lista.fields.fotosVersion ? Number(valor(lista.fields.fotosVersion)) : 0)
      } else {
        items.value = MENU_INICIAL.map(normalizar) // todavía no hay menú guardado: se usa el inicial
        try { localStorage.removeItem(CACHE) } catch { /* sin almacenamiento */ }
        await sincronizarFotos(0)
      }
    }
  } catch { /* sin conexión: se queda lo último que se vio */ }
  finally { cargado.value = true }
}

// ---------- Consultas ----------
const visibles = computed(() => items.value.filter((i) => i.activo))
export const especialidades = computed(() => visibles.value.filter((i) => i.tipo === 'especialidad'))
export const paquetes = computed(() => visibles.value.filter((i) => i.tipo === 'paquete'))
export const adicionales = computed(() => visibles.value.filter((i) => i.tipo === 'adicional'))
export const secciones = computed(() => {
  const orden = ['calzones', 'bebidas', 'otros']
  const vistos = new Map()
  adicionales.value.forEach((a) => { const c = orden.includes(a.categoria) ? a.categoria : 'otros'; if (!vistos.has(c)) vistos.set(c, []); vistos.get(c).push(a) })
  return orden.filter((c) => vistos.has(c)).map((c) => ({ categoria: c, lista: vistos.get(c) }))
})
export const favoritas = computed(() => visibles.value.filter((i) => i.favorita))
export const enPromocion = computed(() => visibles.value.filter((i) => hayPromo(i)))
export const recetas = computed(() => especialidades.value.filter((e) => e.ingredientes.length))

export const hayPromo = (it) => it.enPromo && it.precioPromo != null && it.precioPromo > 0 && it.precioPromo < it.precio
export const precioFinal = (it) => (hayPromo(it) ? it.precioPromo : it.precio)
export const rutaDe = (it) => (it.tipo === 'especialidad' ? '/especialidades' : it.tipo === 'paquete' ? '/paquetes' : '/adicionales')
export { precioPorTamano }

// Foto: biblioteca incluida ('lib:clave'), una dirección https, o ninguna (se usa el emoji).
export const FOTOS_BIBLIOTECA = [
  ...['solitaria', 'clasica', 'pepechon', 'ambivalente', 'carnivora', 'vegetariana', 'rinconada'].map((k) => ({ clave: k, nombre: k[0].toUpperCase() + k.slice(1), url: imgEspecialidad(k) })),
  { clave: 'calzone', nombre: 'Calzone', url: imgCalzone },
  { clave: 'base', nombre: 'Pizza de queso', url: imgBase },
]
// Convierte el valor guardado en un producto (o en el carrito) en una dirección de imagen usable.
export function resolverFoto(f) {
  if (!f) return null
  if (f.startsWith('lib:')) return FOTOS_BIBLIOTECA.find((x) => x.clave === f.slice(4))?.url || null
  if (f.startsWith('sub:')) return fotosSubidas.value[f.slice(4)] || null
  if (/^https:\/\//i.test(f) || f.startsWith('data:image/') || f.startsWith('/')) return f // dirección directa (o valores antiguos del carrito)
  return null
}
export const fotoDe = (it) => resolverFoto(it?.foto)
