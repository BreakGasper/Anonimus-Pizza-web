// Historial de pedidos hechos en ESTE dispositivo (para quien compra sin cuenta). Solo se guarda en el navegador.
const CLAVE = 'anonimus-mis-pedidos'
const MAX = 50

export function leerHistorial() {
  try { const v = JSON.parse(localStorage.getItem(CLAVE)); return Array.isArray(v) ? v : [] } catch { return [] }
}

export function guardarEnHistorial(p) {
  const lista = leerHistorial().filter((x) => x.id !== p.id)
  lista.unshift({
    id: p.id, fecha: p.fecha, nombre: p.nombre, telefono: p.telefono, direccion: p.direccion, notas: p.notas || '', total: p.total,
    items: p.items.map((i) => ({ nombre: i.nombre, detalle: i.detalle || '', cantidad: i.cantidad, precio: i.precio })),
  })
  try { localStorage.setItem(CLAVE, JSON.stringify(lista.slice(0, MAX))) } catch { /* sin almacenamiento */ }
}

export function borrarHistorial() { try { localStorage.removeItem(CLAVE) } catch { /* sin almacenamiento */ } }

// Marca de que este navegador tiene (o tuvo) una sesión de cliente; permite cargar el SDK de cuentas solo cuando hace falta.
export const CLAVE_SESION = 'anonimus-sesion-cliente'
