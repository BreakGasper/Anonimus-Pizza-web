import { ref, computed, watch } from 'vue'

const KEY = 'anonimus-carrito'
const MAX_LINEAS = 30 // coincide con el límite de items en firestore.rules
const MAX_CANTIDAD = 20

function cargar() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY))
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export const items = ref(cargar())
export const ultimoPedido = ref(null) // para mostrar el ticket tras confirmar

watch(items, (v) => {
  try { localStorage.setItem(KEY, JSON.stringify(v)) } catch { /* sin almacenamiento */ }
}, { deep: true })

export const total = computed(() => items.value.reduce((s, i) => s + i.precio * i.cantidad, 0))
export const cantidad = computed(() => items.value.reduce((s, i) => s + i.cantidad, 0))

// item: { clave, nombre, detalle, precio }. Devuelve false si el carrito está lleno.
export function agregar(item) {
  const existente = items.value.find((i) => i.clave === item.clave)
  if (existente) {
    existente.cantidad = Math.min(MAX_CANTIDAD, existente.cantidad + 1)
    return true
  }
  if (items.value.length >= MAX_LINEAS) return false
  items.value.push({ ...item, cantidad: 1 })
  return true
}

export function cambiar(clave, delta) {
  const i = items.value.find((x) => x.clave === clave)
  if (!i) return
  i.cantidad = Math.min(MAX_CANTIDAD, i.cantidad + delta)
  if (i.cantidad <= 0) quitar(clave)
}

export function quitar(clave) {
  items.value = items.value.filter((i) => i.clave !== clave)
}

export function vaciar() {
  items.value = []
}
