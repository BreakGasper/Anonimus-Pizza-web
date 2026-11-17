// Menú de ejemplo (nombres y precios ficticios; ajústalos a tu carta real).
export const TAMANOS = [
  { id: 'ind', nombre: 'Individual', cm: '20 cm', factor: 0.6 },
  { id: 'med', nombre: 'Mediana', cm: '30 cm', factor: 1 },
  { id: 'fam', nombre: 'Familiar', cm: '40 cm', factor: 1.4 },
]

// Precio de una pizza en un tamaño, a partir del precio de la mediana (redondeado a $5).
export const precioPorTamano = (precioMediana, tamano) =>
  Math.round((precioMediana * tamano.factor) / 5) * 5

export const ESPECIALIDADES = [
  { id: 'solitaria', nombre: 'Solitaria', emoji: '🍍', precio: 175, desc: 'Jamón, salchicha, pepperoni, champiñones y piña.' },
  { id: 'clasica', nombre: 'Clásica', emoji: '🍕', precio: 150, desc: 'Salsa de tomate, queso mozzarella y pepperoni.' },
  { id: 'pepechon', nombre: 'Pepechon', emoji: '🌶️', precio: 165, desc: 'Doble pepperoni, chorizo y chile jalapeño.' },
  { id: 'ambivalente', nombre: 'Ambivalente', emoji: '🧀', precio: 170, desc: 'Mitad hawaiana, mitad mexicana.' },
  { id: 'carnivora', nombre: 'Carnívora', emoji: '🥩', precio: 185, desc: 'Jamón, tocino, salchicha, chorizo y pepperoni.' },
  { id: 'vegetariana', nombre: 'Vegetariana', emoji: '🥬', precio: 160, desc: 'Champiñones, pimiento, cebolla, aceituna y elote.' },
  { id: 'rinconada', nombre: 'Rinconada', emoji: '🔥', precio: 180, desc: 'Cochinita, cebolla morada y chile habanero.' },
]

// "Arma tu pizza": precio base de la mediana con 3 ingredientes incluidos.
export const ARMA = {
  precioMediana: 150,
  incluidos: 3,
  precioExtraIngrediente: 15,
  extras: [
    { id: 'salsa', nombre: 'Extra salsa de tomate', precio: 10 },
    { id: 'queso', nombre: 'Extra queso', precio: 20 },
  ],
  verduras: ['Champiñones', 'Pimiento', 'Cebolla', 'Aceitunas', 'Elote', 'Piña', 'Jalapeño', 'Tomate'],
  carnes: ['Pepperoni', 'Jamón', 'Salchicha', 'Chorizo', 'Tocino', 'Carne molida', 'Pollo'],
}

export const PAQUETES = [
  { id: 'solo', nombre: 'Solo para ti', emoji: '🙋', precio: 99, desc: '1 pizza individual Clásica + 1 refresco de lata.' },
  { id: 'duo', nombre: 'Dúo clásico', emoji: '👫', precio: 320, desc: '2 pizzas medianas Clásica + 1 refresco de 2 L.' },
  { id: 'fiesta', nombre: 'Fiesta', emoji: '🎉', precio: 399, desc: '1 pizza familiar Pepechon + 3 calzones + 2 refrescos de 2 L.' },
]

export const ADICIONALES = {
  calzones: [
    { id: 'calz-solitario', nombre: 'Calzone Solitario', emoji: '🥟', precio: 70, desc: 'Jamón, salchicha, pepperoni, champiñones y piña.' },
    { id: 'calz-clasico', nombre: 'Calzone Clásico', emoji: '🥟', precio: 65, desc: 'Queso mozzarella y pepperoni.' },
    { id: 'calz-veg', nombre: 'Calzone Vegetariano', emoji: '🥟', precio: 65, desc: 'Champiñones, pimiento y elote.' },
  ],
  bebidas: [
    { id: 'beb-lata', nombre: 'Refresco de lata', emoji: '🥤', precio: 25, desc: 'Cualquier sabor, 355 ml.' },
    { id: 'beb-2l', nombre: 'Refresco de 2 L', emoji: '🥤', precio: 45, desc: 'Cualquier sabor.' },
    { id: 'beb-agua', nombre: 'Agua natural', emoji: '💧', precio: 20, desc: '600 ml.' },
  ],
}

export const money = (n) => '$' + Number(n).toLocaleString('es-MX')
