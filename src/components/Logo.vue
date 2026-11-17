<script setup>
// Redibujo en SVG del logo de Anonimus Pizza. `completo` agrega letrero, nube y cinta.
defineProps({ completo: { type: Boolean, default: false } })
</script>

<template>
  <svg v-if="completo" viewBox="0 0 420 380" role="img" aria-label="Anonimus Pizza: pizza, calzone y algo más" class="logo">
    <circle cx="190" cy="190" r="160" fill="#0a8a3a" />
    <circle cx="190" cy="190" r="148" fill="#111" />
    <circle cx="190" cy="190" r="140" fill="#a50000" />
    <circle cx="190" cy="190" r="112" fill="#111" />
    <circle cx="190" cy="190" r="106" fill="#0a8a3a" />
    <g stroke-linecap="butt">
      <path d="M128 84 L252 296 M252 84 L128 296" stroke="#fff" stroke-width="54" />
      <path d="M128 84 L252 296 M252 84 L128 296" stroke="#c40000" stroke-width="38" />
    </g>
    <!-- cara -->
    <g>
      <ellipse cx="168" cy="190" rx="17" ry="20" fill="#fff" stroke="#111" stroke-width="3" />
      <ellipse cx="208" cy="190" rx="17" ry="20" fill="#fff" stroke="#111" stroke-width="3" />
      <circle cx="170" cy="194" r="8" fill="#222" /><circle cx="206" cy="194" r="8" fill="#222" />
      <path d="M150 168 Q166 158 182 168 M196 168 Q212 158 228 168" stroke="#111" stroke-width="4" fill="none" stroke-linecap="round" />
      <path d="M160 222 Q188 206 216 222 Q206 232 188 228 Q170 232 160 222Z" fill="#111" />
      <path d="M166 232 Q188 262 212 232 Z" fill="#fff" stroke="#111" stroke-width="2" />
      <path d="M176 246 Q188 258 202 246 Q190 240 176 246Z" fill="#e9547a" />
    </g>
    <!-- letrero -->
    <g transform="rotate(-9 90 130)">
      <rect x="84" y="122" width="12" height="150" fill="#6b3b1a" />
      <rect x="14" y="88" width="170" height="62" rx="4" fill="#a8672f" stroke="#fff" stroke-width="5" />
      <text x="99" y="132" text-anchor="middle" class="sv-letrero">ANONIMUS</text>
    </g>
    <path d="M100 246 q-26 8 -22 28 q10 8 28 -2 z" fill="#fff" stroke="#111" stroke-width="3" />
    <path d="M118 268 Q150 276 160 238" stroke="#111" stroke-width="9" fill="none" stroke-linecap="round" />
    <!-- nube -->
    <g>
      <circle cx="262" cy="108" r="6" fill="#fff" stroke="#ccc" /><circle cx="274" cy="92" r="9" fill="#fff" stroke="#ccc" />
      <path d="M290 78 q-14 -28 18 -34 q10 -26 44 -14 q36 -10 46 24 q22 22 -6 44 q-14 22 -48 12 q-30 16 -52 -8 q-22 -4 -2 -24z" fill="#fff" stroke="#bbb" stroke-width="3" />
      <text x="354" y="86" text-anchor="middle" class="sv-nube"><tspan fill="#0a8a3a">¿?</tspan><tspan fill="#111">IZ</tspan><tspan fill="#c40000">ZA…</tspan></text>
    </g>
    <!-- cinta -->
    <path d="M36 298 L74 298 L60 330 L74 358 L34 358 L18 330Z" fill="#a50000" stroke="#fff" stroke-width="5" stroke-linejoin="round" />
    <path d="M346 298 L384 298 L402 330 L388 358 L346 358 L360 330Z" fill="#a50000" stroke="#fff" stroke-width="5" stroke-linejoin="round" />
    <rect x="58" y="290" width="304" height="62" rx="4" fill="#c40000" stroke="#fff" stroke-width="5" />
    <text x="210" y="332" text-anchor="middle" class="sv-cinta">PIZZA, CALZONE Y ALGO MÁS</text>
  </svg>

  <svg v-else viewBox="0 0 200 200" role="img" aria-label="Anonimus Pizza" class="logo">
    <circle cx="100" cy="100" r="96" fill="#0a8a3a" />
    <circle cx="100" cy="100" r="88" fill="#111" />
    <circle cx="100" cy="100" r="82" fill="#a50000" />
    <circle cx="100" cy="100" r="62" fill="#111" /><circle cx="100" cy="100" r="58" fill="#0a8a3a" />
    <path d="M62 40 L138 160 M138 40 L62 160" stroke="#fff" stroke-width="34" />
    <path d="M62 40 L138 160 M138 40 L62 160" stroke="#c40000" stroke-width="22" />
    <ellipse cx="86" cy="98" rx="10" ry="12" fill="#fff" stroke="#111" stroke-width="2" />
    <ellipse cx="114" cy="98" rx="10" ry="12" fill="#fff" stroke="#111" stroke-width="2" />
    <circle cx="87" cy="101" r="5" fill="#222" /><circle cx="113" cy="101" r="5" fill="#222" />
    <path d="M80 120 Q100 110 120 120 Q112 128 100 125 Q88 128 80 120Z" fill="#111" />
    <path d="M86 128 Q100 148 114 128Z" fill="#fff" />
  </svg>
</template>

<style>
.logo { display: block; width: 100%; height: auto; }
.sv-letrero { font: 900 24px 'Arial Black', Impact, sans-serif; fill: #fff; stroke: #111; stroke-width: 3; paint-order: stroke; }
.sv-nube { font: 900 28px 'Arial Black', Impact, sans-serif; }
.sv-cinta { font: 700 25px 'Barlow Condensed', Impact, 'Arial Narrow', sans-serif; fill: #fff; letter-spacing: .02em; }
</style>
