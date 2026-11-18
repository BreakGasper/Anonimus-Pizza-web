<script setup>
import { money } from '../data/menu.js'
defineProps({
  nombre: { type: String, required: true }, desc: String, precio: { type: Number, required: true }, precioOriginal: Number,
  foto: String, emoji: String, desde: Boolean, etiqueta: String,
})
defineEmits(['agregar'])
</script>

<template>
  <article class="prod">
    <div class="prod-foto">
      <img v-if="foto" :src="foto" :alt="nombre" loading="lazy" decoding="async" />
      <span v-else class="prod-emoji" aria-hidden="true">{{ emoji || '🍕' }}</span>
      <span v-if="etiqueta" class="prod-etiqueta">{{ etiqueta }}</span>
    </div>
    <div class="prod-cuerpo">
      <h3>{{ nombre }}</h3>
      <p class="desc">{{ desc }}</p>
      <div class="prod-pie">
        <div class="precio">
          <s v-if="precioOriginal" class="tachado">{{ money(precioOriginal) }}</s>
          <small v-if="desde">desde </small>{{ money(precio) }}
        </div>
        <button type="button" class="btn chico" @click="$emit('agregar')">Agregar</button>
      </div>
    </div>
  </article>
</template>
