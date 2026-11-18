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
