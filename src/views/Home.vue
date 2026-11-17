<script setup>
import Logo from '../components/Logo.vue'
</script>

<template>
  <section class="hero">
    <div class="hero-logo"><Logo completo /></div>
    <h1>Tu pizza, a tu puerta</h1>
    <p>Elige una especialidad o arma la tuya con los ingredientes que quieras.</p>
    <router-link to="/arma" class="btn">Arma tu pizza</router-link>
  </section>

  <div class="rejilla">
    <router-link to="/especialidades" class="azulejo"><span class="em">📖</span><b>Especialidades</b></router-link>
    <router-link to="/arma" class="azulejo"><span class="em">👨‍🍳</span><b>Arma tu pizza</b></router-link>
    <router-link to="/paquetes" class="azulejo"><span class="em">🎁</span><b>Paquetes y promos</b></router-link>
    <router-link to="/adicionales" class="azulejo"><span class="em">🥤</span><b>Adicionales</b></router-link>
  </div>

  <div class="tarjeta" style="margin-top:18px">
    <h3>¿Cómo pedir?</h3>
    <p class="desc">1. Elige tus productos · 2. Revisa el carrito · 3. Deja tu dirección y teléfono · 4. Te llevamos tu pedido y pagas al recibir.</p>
  </div>
</template>
