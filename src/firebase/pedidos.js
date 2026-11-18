import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from './db.js'
import { CLAVE_SESION } from '../store/historial.js'

// Si el cliente tiene sesión, el pedido queda a su nombre (uid) y lo verá en su perfil.
async function uidDelCliente() {
  try {
    if (localStorage.getItem(CLAVE_SESION) !== '1') return null // sin sesión: ni siquiera se carga el SDK de cuentas
    const { auth } = await import('./auth.js')
    await auth.authStateReady()
    return auth.currentUser?.uid || null
  } catch { return null }
}

// Crea un pedido con exactamente los campos que permite firestore.rules.
export async function crearPedido({ nombre, telefono, direccion, notas }, items, total) {
  const datos = {
    nombre,
    telefono,
    direccion,
    items: items.map((i) => ({ nombre: i.nombre, detalle: i.detalle || '', cantidad: i.cantidad, precio: i.precio })),
    total,
    estado: 'nuevo',
    creado: serverTimestamp(),
  }
  if (notas) datos.notas = notas
  const uid = await uidDelCliente()
  if (uid) datos.uid = uid
  const ref = await addDoc(collection(db, 'pedidos'), datos)
  return ref.id
}
