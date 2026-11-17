// Configuración web de Firebase: es pública por diseño (la seguridad la dan firestore.rules).
import { initializeApp } from 'firebase/app'

export const firebaseConfig = {
  apiKey: 'AIzaSyDI1JEYlUPwr3equONDw0KaxS-z866eyIY',
  authDomain: 'anonimus-pizza.firebaseapp.com',
  projectId: 'anonimus-pizza',
  storageBucket: 'anonimus-pizza.firebasestorage.app',
  messagingSenderId: '559100000308',
  appId: '1:559100000308:web:602058d8aaba28d4937261',
  measurementId: 'G-5366X5XD41',
}

export const app = initializeApp(firebaseConfig)
