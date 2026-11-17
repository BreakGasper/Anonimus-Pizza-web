import { readFileSync } from 'node:fs'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { serverTimestamp, doc, setDoc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore'

const ADMIN = 'breakgasper@gmail.com'
const env = await initializeTestEnvironment({
  projectId: 'demo-anonimus-pizza',
  firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
})

const valido = () => ({
  nombre: 'Ana', telefono: '5551234567', direccion: 'Calle 1', items: [{ n: 'Pepperoni', q: 1 }],
  total: 150, estado: 'nuevo', creado: serverTimestamp(),
})
const anon = env.unauthenticatedContext().firestore()
const admin = env.authenticatedContext('a', { email: ADMIN, email_verified: true }).firestore()
const adminNoVerif = env.authenticatedContext('b', { email: ADMIN, email_verified: false }).firestore()
const otro = env.authenticatedContext('c', { email: 'otro@x.com', email_verified: true }).firestore()

let fallos = 0
async function t(nombre, p) {
  try { await p; console.log('OK  ', nombre) } catch (e) { fallos++; console.log('FALLA', nombre, e.message.split('\n')[0]) }
}

await t('visitante crea pedido válido', assertSucceeds(setDoc(doc(anon, 'pedidos/p1'), valido())))
await t('visitante NO crea con estado distinto', assertFails(setDoc(doc(anon, 'pedidos/p2'), { ...valido(), estado: 'entregado' })))
await t('visitante NO crea con campo extra', assertFails(setDoc(doc(anon, 'pedidos/p3'), { ...valido(), admin: true })))
await t('visitante NO crea sin items', assertFails(setDoc(doc(anon, 'pedidos/p4'), { ...valido(), items: [] })))
await t('visitante NO crea con total negativo', assertFails(setDoc(doc(anon, 'pedidos/p5'), { ...valido(), total: -1 })))
await t('visitante NO crea con fecha falsa', assertFails(setDoc(doc(anon, 'pedidos/p6'), { ...valido(), creado: new Date(0) })))
await t('visitante NO lee', assertFails(getDoc(doc(anon, 'pedidos/p1'))))
await t('visitante NO edita', assertFails(updateDoc(doc(anon, 'pedidos/p1'), { estado: 'listo' })))
await t('visitante NO borra', assertFails(deleteDoc(doc(anon, 'pedidos/p1'))))
await t('otro usuario NO lee', assertFails(getDoc(doc(otro, 'pedidos/p1'))))
await t('admin sin verificar NO lee', assertFails(getDoc(doc(adminNoVerif, 'pedidos/p1'))))
await t('admin lee', assertSucceeds(getDoc(doc(admin, 'pedidos/p1'))))
await t('admin edita', assertSucceeds(updateDoc(doc(admin, 'pedidos/p1'), { estado: 'listo' })))
await t('admin borra', assertSucceeds(deleteDoc(doc(admin, 'pedidos/p1'))))
await t('colección desconocida cerrada', assertFails(setDoc(doc(admin, 'otra/x'), { a: 1 })))

await env.cleanup()
console.log(fallos ? `\n${fallos} prueba(s) fallaron` : '\nTodas las pruebas pasaron')
process.exit(fallos ? 1 : 0)
