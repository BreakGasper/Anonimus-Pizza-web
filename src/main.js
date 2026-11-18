import { createApp } from 'vue'
import App from './App.vue'
import router from './router.js'
import { bloquearZoomTactil } from './sinzoom.js'
import { cargarMenu } from './store/menu.js'
import './styles.css'

bloquearZoomTactil()
cargarMenu() // lee el menú guardado (1 lectura); mientras tanto se usa el último visto o el menú inicial
createApp(App).use(router).mount('#app')
