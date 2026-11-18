// Configuración web de Firebase: es pública por diseño (la seguridad la dan firestore.rules).
// Va aparte, sin importar el SDK, para que la tienda pueda usarla sin cargarlo.
export const firebaseConfig = {
  apiKey: 'AIzaSyDI1JEYlUPwr3equONDw0KaxS-z866eyIY',
  authDomain: 'anonimus-pizza.firebaseapp.com',
  projectId: 'anonimus-pizza',
  storageBucket: 'anonimus-pizza.firebasestorage.app',
  messagingSenderId: '559100000308',
  appId: '1:559100000308:web:602058d8aaba28d4937261',
  measurementId: 'G-5366X5XD41',
}

// El acceso por teléfono del panel de administración usa un correo "de mentira" derivado del teléfono.
// Ni el teléfono ni la contraseña están en el código: se crean en la consola de Firebase.
export const DOMINIO_ADMIN = 'admin.anonimus.pizza'
export const correoDeTelefono = (tel) => `${String(tel).replace(/\D/g, '')}@${DOMINIO_ADMIN}`
