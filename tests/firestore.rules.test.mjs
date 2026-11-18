import { readFileSync } from 'node:fs'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { serverTimestamp, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, collection, query, where } from 'firebase/firestore'

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
await t('ni el admin puede borrar pedidos (se cancelan)', assertFails(deleteDoc(doc(admin, 'pedidos/p1'))))
await t('colección desconocida cerrada', assertFails(setDoc(doc(admin, 'otra/x'), { a: 1 })))

await t('cuenta de /admins lee pedidos', assertSucceeds(getDoc(doc(listaAdmin, 'pedidos/semilla'))))
await t('cuenta de /admins edita pedidos', assertSucceeds(updateDoc(doc(listaAdmin, 'pedidos/semilla'), { estado: 'preparando' })))
await t('ni una cuenta de /admins puede borrar pedidos', assertFails(deleteDoc(doc(listaAdmin, 'pedidos/semilla'))))
await t('el admin cancela un pedido (con la fecha de cancelación)', assertSucceeds(updateDoc(doc(listaAdmin, 'pedidos/semilla'), { estado: 'cancelado', canceladoEn: serverTimestamp() })))
await t('cuenta fuera de /admins NO lee pedidos', assertFails(getDoc(doc(sinLista, 'pedidos/semilla'))))
await t('cuenta fuera de /admins NO edita pedidos', assertFails(updateDoc(doc(sinLista, 'pedidos/semilla'), { estado: 'listo' })))
await t('nadie puede agregarse a /admins (ni un admin)', assertFails(setDoc(doc(listaAdmin, 'admins/uotro'), { nombre: 'x' })))
await t('un usuario no puede hacerse admin a sí mismo', assertFails(setDoc(doc(sinLista, 'admins/uotro'), { nombre: 'x' })))
await t('un admin lee su propio registro', assertSucceeds(getDoc(doc(listaAdmin, 'admins/uadmin'))))
await t('no se puede leer el registro de otro', assertFails(getDoc(doc(sinLista, 'admins/uadmin'))))
await t('visitante anónimo NO lee /admins', assertFails(getDoc(doc(anon, 'admins/uadmin'))))
await t('los visitantes siguen creando pedidos válidos', assertSucceeds(setDoc(doc(anon, 'pedidos/nuevo1'), valido())))

const menu = () => ({ items: [{ id: 'a', tipo: 'especialidad', nombre: 'Prueba', precio: 100 }] })
await t('cualquiera lee el menú (config/menu)', assertSucceeds(getDoc(doc(anon, 'config/menu'))))
await t('visitante NO escribe el menú', assertFails(setDoc(doc(anon, 'config/menu'), menu())))
await t('cuenta fuera de /admins NO escribe el menú', assertFails(setDoc(doc(sinLista, 'config/menu'), menu())))
await t('admin de Google escribe el menú', assertSucceeds(setDoc(doc(admin, 'config/menu'), menu())))
await t('cuenta de /admins escribe el menú', assertSucceeds(setDoc(doc(listaAdmin, 'config/menu'), menu())))
await t('el menú debe traer una lista items', assertFails(setDoc(doc(listaAdmin, 'config/menu'), { items: 'x' })))
await t('el menú no puede pasar de 150 elementos', assertFails(setDoc(doc(listaAdmin, 'config/menu'), { items: Array.from({ length: 151 }, (_, i) => ({ id: String(i) })) })))
await t('otros documentos de config siguen cerrados para escritura', assertFails(setDoc(doc(anon, 'config/otro'), menu())))

// ---- Clientes con cuenta: ven solo sus pedidos ----
const ana = env.authenticatedContext('ana', { email: 'ana@correo.com' }).firestore()
const beto = env.authenticatedContext('beto', { email: 'beto@correo.com' }).firestore()
await t('cliente con sesión crea un pedido a su nombre (uid)', assertSucceeds(setDoc(doc(ana, 'pedidos/ped-ana'), { ...valido(), uid: 'ana' })))
await t('cliente NO puede crear un pedido a nombre de otro', assertFails(setDoc(doc(ana, 'pedidos/ped-falso'), { ...valido(), uid: 'beto' })))
await t('visitante sin sesión NO puede poner uid', assertFails(setDoc(doc(anon, 'pedidos/ped-anon-uid'), { ...valido(), uid: 'ana' })))
await t('el visitante sin cuenta sigue creando pedidos (sin uid)', assertSucceeds(setDoc(doc(anon, 'pedidos/ped-invitado'), valido())))
await t('el uid debe ser texto igual al de la sesión (no un campo suelto)', assertFails(setDoc(doc(ana, 'pedidos/ped-raro'), { ...valido(), uid: 123 })))
await t('el dueño lee su pedido', assertSucceeds(getDoc(doc(ana, 'pedidos/ped-ana'))))
await t('el dueño lista sus pedidos (where uid == suyo)', assertSucceeds(getDocs(query(collection(ana, 'pedidos'), where('uid', '==', 'ana')))))
await t('otro cliente NO lee un pedido ajeno', assertFails(getDoc(doc(beto, 'pedidos/ped-ana'))))
await t('otro cliente NO lista pedidos ajenos (where uid == ana)', assertFails(getDocs(query(collection(beto, 'pedidos'), where('uid', '==', 'ana')))))
await t('un cliente NO puede listar todos los pedidos', assertFails(getDocs(collection(ana, 'pedidos'))))
await t('el visitante NO lee pedidos con uid', assertFails(getDoc(doc(anon, 'pedidos/ped-ana'))))
await t('el cliente NO lee un pedido de invitado (sin uid)', assertFails(getDoc(doc(ana, 'pedidos/ped-invitado'))))
await t('el dueño NO edita su pedido (ni cambia el estado)', assertFails(updateDoc(doc(ana, 'pedidos/ped-ana'), { estado: 'entregado' })))
await t('el dueño NO borra su pedido', assertFails(deleteDoc(doc(ana, 'pedidos/ped-ana'))))
await t('el admin sigue leyendo y cambiando pedidos con uid', assertSucceeds(updateDoc(doc(listaAdmin, 'pedidos/ped-ana'), { estado: 'preparando' })))
await t('el dueño ve el cambio de estado hecho por el admin', assertSucceeds(getDoc(doc(ana, 'pedidos/ped-ana'))))

// ---- Fotos subidas (config/fotos) ----
const foto = (n) => ({ fotos: Object.fromEntries(Array.from({ length: n }, (_, i) => ['f' + i, 'data:image/webp;base64,AAAA'])), version: 1 })
await t('cualquiera lee las fotos (config/fotos)', assertSucceeds(getDoc(doc(anon, 'config/fotos'))))
await t('visitante NO sube fotos', assertFails(setDoc(doc(anon, 'config/fotos'), foto(1))))
await t('cuenta fuera de /admins NO sube fotos', assertFails(setDoc(doc(sinLista, 'config/fotos'), foto(1))))
await t('admin sube hasta 20 fotos', assertSucceeds(setDoc(doc(listaAdmin, 'config/fotos'), foto(20))))
await t('no se permiten 21 fotos', assertFails(setDoc(doc(listaAdmin, 'config/fotos'), foto(21))))
await t('fotos debe ser un mapa', assertFails(setDoc(doc(listaAdmin, 'config/fotos'), { fotos: 'x' })))
await t('un admin puede dejar el mapa vacío (borrar fotos)', assertSucceeds(setDoc(doc(listaAdmin, 'config/fotos'), { fotos: {}, version: 2 })))
await t('no se puede esquivar el tope poniendo "items" en config/fotos', assertFails(setDoc(doc(listaAdmin, 'config/fotos'), { ...foto(21), items: [] })))
await t('ni el admin escribe otros documentos de config', assertFails(setDoc(doc(listaAdmin, 'config/otro'), { items: [] })))

// ---- Reclamar un pedido hecho sin sesión (invitado -> cuenta) ----
await env.withSecurityRulesDisabled(async (ctx) => {
  const f = ctx.firestore()
  await setDoc(doc(f, 'pedidos/inv1'), { ...valido(), creado: new Date() })
  await setDoc(doc(f, 'pedidos/inv2'), { ...valido(), creado: new Date() })
  await setDoc(doc(f, 'pedidos/inv3'), { ...valido(), creado: new Date() })
  await setDoc(doc(f, 'pedidos/inv4'), { ...valido(), creado: new Date() })
  await setDoc(doc(f, 'pedidos/deBeto'), { ...valido(), creado: new Date(), uid: 'beto' })
})
await t('el cliente reclama un pedido de invitado (solo pone su uid)', assertSucceeds(updateDoc(doc(ana, 'pedidos/inv1'), { uid: 'ana' })))
await t('...y después lo puede leer', assertSucceeds(getDoc(doc(ana, 'pedidos/inv1'))))
await t('NO puede reclamar un pedido que ya tiene dueño', assertFails(updateDoc(doc(ana, 'pedidos/deBeto'), { uid: 'ana' })))
await t('NO puede reclamarlo a nombre de otra persona', assertFails(updateDoc(doc(ana, 'pedidos/inv2'), { uid: 'beto' })))
await t('NO puede cambiar otros campos al reclamar (estado)', assertFails(updateDoc(doc(ana, 'pedidos/inv2'), { uid: 'ana', estado: 'entregado' })))
await t('NO puede cambiar otros campos al reclamar (total)', assertFails(updateDoc(doc(ana, 'pedidos/inv2'), { uid: 'ana', total: 1 })))
await t('el visitante sin sesión NO puede reclamar', assertFails(updateDoc(doc(anon, 'pedidos/inv3'), { uid: 'ana' })))
await t('un pedido ya reclamado no se puede volver a reclamar por otro', assertFails(updateDoc(doc(beto, 'pedidos/inv1'), { uid: 'beto' })))
await t('el dueño no puede quitarse ni cambiar el uid', assertFails(updateDoc(doc(ana, 'pedidos/inv1'), { uid: 'beto' })))
await t('el admin sigue pudiendo actualizar el estado de un pedido reclamado', assertSucceeds(updateDoc(doc(listaAdmin, 'pedidos/inv1'), { estado: 'preparando' })))

await env.cleanup()
console.log(fallos ? `\n${fallos} prueba(s) fallaron` : '\nTodas las pruebas pasaron')
process.exit(fallos ? 1 : 0)
