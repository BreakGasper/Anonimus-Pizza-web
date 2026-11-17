import { createRouter, createWebHistory } from 'vue-router'
import Home from './views/Home.vue'

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Home },
    { path: '/especialidades', component: () => import('./views/Especialidades.vue') },
    { path: '/arma', component: () => import('./views/ArmaPizza.vue') },
    { path: '/paquetes', component: () => import('./views/Paquetes.vue') },
    { path: '/adicionales', component: () => import('./views/Adicionales.vue') },
    { path: '/carrito', component: () => import('./views/Carrito.vue') },
    { path: '/ticket', component: () => import('./views/Ticket.vue') },
    { path: '/admin', component: () => import('./views/Admin.vue'), meta: { admin: true } },
    { path: '/:resto(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})
