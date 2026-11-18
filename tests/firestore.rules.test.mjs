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

// Cuenta de la lista /admins (se crea "desde la consola": con las reglas desactivadas)
await env.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), 'admins/uadmin'), { nombre: 'Admin' })
  await setDoc(doc(ctx.firestore(), 'pedidos/semilla'), { ...valido(), creado: new Date() })
})
const listaAdmin = env.authenticatedContext('uadmin', { email: '3750000000@admin.anonimus.pizza' }).firestore()
const sinLista = env.authenticatedContext('uotro', { email: '3750000001@admin.anonimus.pizza' }).firestore()

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

await t('cuenta de /admins lee pedidos', assertSucceeds(getDoc(doc(listaAdmin, 'pedidos/semilla'))))
await t('cuenta de /admins edita pedidos', assertSucceeds(updateDoc(doc(listaAdmin, 'pedidos/semilla'), { estado: 'preparando' })))
await t('cuenta de /admins borra pedidos', assertSucceeds(deleteDoc(doc(listaAdmin, 'pedidos/semilla'))))
await t('cuenta fuera de /admins NO lee pedidos', assertFails(getDoc(doc(sinLista, 'pedidos/semilla'))))
await t('cuenta fuera de /admins NO edita pedidos', assertFails(updateDoc(doc(sinLista, 'pedidos/semilla'), { estado: 'listo' })))
await t('nadie puede agregarse a /admins (ni un admin)', assertFails(setDoc(doc(listaAdmin, 'admins/uotro'), { nombre: 'x' })))
await t('un usuario no puede hacerse admin a sí mismo', assertFails(setDoc(doc(sinLista, 'admins/uotro'), { nombre: 'x' })))
await t('un admin lee su propio registro', assertSucceeds(getDoc(doc(listaAdmin, 'admins/uadmin'))))
await t('no se puede leer el registro de otro', assertFails(getDoc(doc(sinLista, 'admins/uadmin'))))
await t('visitante anónimo NO lee /admins', assertFails(getDoc(doc(anon, 'admins/uadmin'))))
await t('los visitantes siguen creando pedidos válidos', assertSucceeds(setDoc(doc(anon, 'pedidos/nuevo1'), valido())))

await env.cleanup()
console.log(fallos ? `\n${fallos} prueba(s) fallaron` : '\nTodas las pruebas pasaron')
process.exit(fallos ? 1 : 0)
