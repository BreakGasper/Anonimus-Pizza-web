import { initializeApp } from 'firebase/app'
import { firebaseConfig } from './claves.js'

export { firebaseConfig }
export const app = initializeApp(firebaseConfig)
