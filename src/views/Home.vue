<script setup>
import Logo from '../components/Logo.vue'
import { money } from '../data/menu.js'
import { imgBase } from '../data/imagenes.js'
import { favoritas, enPromocion, precioFinal, hayPromo, fotoDe, rutaDe } from '../store/menu.js'
</script>

<template>
  <section class="hero">
    <div>
      <div class="hero-logo"><Logo completo /></div>
      <h1>Tu pizza,<br /><em>a tu puerta</em></h1>
      <p>Pizza, calzone y algo más. Elige una especialidad o arma la tuya con los ingredientes que quieras y mira cómo se ve antes de pedirla.</p>
      <div class="hero-acciones">
        <router-link to="/arma" class="btn">Arma tu pizza</router-link>
        <router-link to="/especialidades" class="btn claro">Ver el menú</router-link>
      </div>
    </div>
    <img :src="imgBase" alt="" class="hero-pizza" width="420" height="420" />
  </section>

  <section v-if="enPromocion.length" class="seccion">
    <div class="seccion-cab"><h2>🏷️ En promoción</h2></div>
    <div class="carrusel">
      <router-link v-for="e in enPromocion" :key="e.id" :to="rutaDe(e)" class="fav promo-fav">
        <span class="fav-etq">Promo</span>
        <img v-if="fotoDe(e)" :src="fotoDe(e)" :alt="e.nombre" loading="lazy" width="112" height="112" />
        <span v-else class="fav-emoji" aria-hidden="true">{{ e.emoji || '🍕' }}</span>
        <b>{{ e.nombre }}</b>
        <span class="desc"><s class="tachado">{{ money(e.precio) }}</s> <b class="ahora">{{ money(precioFinal(e)) }}</b></span>
      </router-link>
    </div>
  </section>

  <section v-if="favoritas.length" class="seccion">
    <div class="seccion-cab"><h2>Las favoritas</h2><router-link to="/especialidades">Ver todas →</router-link></div>
    <div class="carrusel">
      <router-link v-for="e in favoritas" :key="e.id" :to="rutaDe(e)" class="fav">
        <img v-if="fotoDe(e)" :src="fotoDe(e)" :alt="e.nombre" loading="lazy" width="112" height="112" />
        <span v-else class="fav-emoji" aria-hidden="true">{{ e.emoji || '🍕' }}</span>
        <b>{{ e.nombre }}</b>
        <span class="desc">{{ hayPromo(e) ? '' : 'desde ' }}{{ money(precioFinal(e)) }}</span>
      </router-link>
    </div>
  </section>

  <section class="seccion">
    <h2 style="margin-bottom:12px">Pedir es fácil</h2>
    <div class="pasos">
      <div class="paso"><i>1</i><div><b>Elige</b><p class="desc">Una especialidad o arma la tuya.</p></div></div>
      <div class="paso"><i>2</i><div><b>Confirma</b><p class="desc">Revisa tu carrito y deja tu dirección.</p></div></div>
      <div class="paso"><i>3</i><div><b>Recibe</b><p class="desc">Te la llevamos y pagas al recibir.</p></div></div>
    </div>
  </section>

  <router-link to="/paquetes" class="promo">
    <span style="font-size:2.4rem" aria-hidden="true">🎁</span>
    <div class="grow" style="flex:1"><b>Paquetes y promos</b><p class="desc" style="color:#bfe6cc;margin:2px 0 0">Más pizza por menos. Mira las promociones.</p></div>
    <span class="btn chico claro">Ver</span>
  </router-link>
</template>
