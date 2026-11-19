import { ref, computed } from 'vue'
import { ARMA } from '../data/menu.js'
import { slugDe, imgIconoSlug } from '../data/imagenes.js'

/* Ingredientes de "Arma tu pizza". Los 12 de fábrica traen su ícono y sus piezas recortadas; el panel puede agregar, quitar,
   ocultar y cambiar la foto de cualquiera. Las fotos propias son imágenes con fondo transparente guardadas en config/ingredientes. */
export const INICIALES = [
  ...ARMA.verduras.map((nombre) => ({ id: slugDe(nombre), nombre, tipo: 'verdura', activo: true, piezas: 0, tam: 0 })),
  ...ARMA.carnes.map((nombre) => ({ id: slugDe(nombre), nombre, tipo: 'carne', activo: true, piezas: 0, tam: 0 })),
]
const DE_FABRICA = new Set(INICIALES.map((i) => i.id))
export const esDeFabrica = (id) => DE_FABRICA.has(id)

export function normalizarIng(it) {
  const n = (v, a, b, d) => { const x = Number(v); return Number.isFinite(x) && x > 0 ? Math.min(b, Math.max(a, Math.round(x))) : d }
  return {
    id: String(it.id || '').slice(0, 40), nombre: String(it.nombre || '').trim().slice(0, 30), tipo: it.tipo === 'carne' ? 'carne' : 'verdura',
    activo: it.activo !== false, piezas: n(it.piezas, 4, 60, 0), tam: n(it.tam, 50, 200, 0), // 0 = automático
  }
}

const CACHE_LISTA = 'anonimus-ing-lista-v1', CACHE_IMG = 'anonimus-ing-img-v1'
const leer = (k) => { try { return JSON.parse(localStorage.getItem(k)) } catch { return null } }
const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* sin almacenamiento */ } }

const lista0 = leer(CACHE_LISTA)
export const ingredientes = ref(Array.isArray(lista0) && lista0.length ? lista0.map(normalizarIng).filter((i) => i.id && i.nombre) : INICIALES)
export const imagenesIng = ref(leer(CACHE_IMG)?.imagenes || {})
export const versionImagenes = () => leer(CACHE_IMG)?.version || 0

export function aplicarLista(lista) { // lista guardada en Firestore (o null = la de fábrica)
  if (Array.isArray(lista)) {
    ingredientes.value = lista.map(normalizarIng).filter((i) => i.id && i.nombre)
    guardar(CACHE_LISTA, lista)
  } else {
    ingredientes.value = INICIALES
    try { localStorage.removeItem(CACHE_LISTA) } catch { /* sin almacenamiento */ }
  }
}
export function aplicarImagenes(imagenes, version) {
  imagenesIng.value = imagenes || {}
  if (imagenes && Object.keys(imagenes).length) guardar(CACHE_IMG, { version, imagenes })
  else { try { localStorage.removeItem(CACHE_IMG) } catch { /* sin almacenamiento */ } }
}

export const activos = computed(() => ingredientes.value.filter((i) => i.activo))
export const verduras = computed(() => activos.value.filter((i) => i.tipo === 'verdura'))
export const carnes = computed(() => activos.value.filter((i) => i.tipo === 'carne'))
export const porNombre = (nombre) => ingredientes.value.find((i) => i.nombre === nombre)
export const tieneFotoPropia = (ing) => !!ing && !!imagenesIng.value[ing.id]
// Imagen (siempre con fondo transparente) para el botón y para arrastrar.
export const urlImagen = (ing) => (!ing ? '' : imagenesIng.value[ing.id] || (esDeFabrica(ing.id) ? imgIconoSlug(ing.id) : ''))
// De una receta (nombres) se quedan solo los ingredientes que siguen existiendo y activos.
export const vigentes = (nombres) => (nombres || []).filter((n) => activos.value.some((i) => i.nombre === n))
