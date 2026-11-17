import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from './db.js'

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
  const ref = await addDoc(collection(db, 'pedidos'), datos)
  return ref.id
}
