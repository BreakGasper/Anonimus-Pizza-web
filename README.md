# Anonimus Pizza

App web para hacer **pedidos de pizzas a domicilio**, personalizadas, con entregas y gestión del día. Los clientes piden desde el celular o la computadora; el personal atiende los pedidos desde un panel con perfiles y permisos.

- **Tienda:** https://anonimus-pizza.web.app
- **Panel del personal:** `/admin`
- **Costo:** corre en el plan gratuito de Firebase (Hosting + Firestore + Authentication); se publica sola desde GitHub.

## Qué hace

**Para el cliente**
- Menú de **especialidades**, **paquetes/promos** y **adicionales** (calzones, bebidas), con fotos.
- **Arma tu pizza:** elige tamaño e ingredientes tocándolos o arrastrándolos, y ve cómo queda la pizza (vista previa realista con posiciones al azar; solo caen los ingredientes que eliges). También hay "Sorpréndeme".
- **Ventana flotante de tu pizza (móvil):** mientras eliges ingredientes, una vista pequeña de la pizza armándose te sigue por la página (aparece cuando la pizza principal no se ve). Se puede **arrastrar**, **agrandar/reducir** (con "Ver completa") y **ocultar**, y también puedes **soltar ingredientes sobre ella**. En pantallas grandes la pizza ya queda fija al lado.
- **Carrito en dos pasos** (carrito → datos de entrega) con los datos guardados en el dispositivo para la siguiente compra.
- **Perfil** (`/perfil`): cuenta con correo/contraseña o Google para ver sus pedidos y tickets, del más reciente al más antiguo, con el estado en vivo. Los pedidos hechos sin cuenta en ese dispositivo se pasan a la cuenta al iniciar sesión.
- Pensada para móvil (barra inferior, sin zoom accidental) y escritorio (menú superior, 2 columnas en "Arma tu pizza"). Interfaz en español, tema oscuro "horno" y un solo set de íconos de línea.

**Para el personal (`/admin`)**
- Pedidos en vivo con aviso sonoro y notificaciones en el teléfono; avanzar estado (nuevo → preparando → en camino → entregado) o **cancelar** (los pedidos no se borran).
- Menú editable: productos, precios, promociones, favoritas, ocultar/ordenar, **fotos** (cámara o galería), ícono de respaldo.
- **Resumen** de ventas por periodo (vendidos, cancelados, ticket promedio, gráfica de 7 días, lo más vendido).
- **Usuarios** del panel con cuatro perfiles (ver tabla).

## Perfiles del panel

Las **reglas de Firestore** hacen cumplir los permisos (no solo la pantalla).

| | Admin | Tienda | Empleado | Repartidor |
|---|---|---|---|---|
| Ver pedidos | todos | todos | solo los **por atender** | solo los **que le asignaron** y van en camino |
| Avanzar estado (un paso a la vez) | sí | sí | sí | solo "en camino → entregado" |
| Asignar repartidor al pasar a "en camino" | sí | sí | sí | no |
| Cambiar de repartidor | sí | sí | no | no |
| Cancelar / reabrir pedidos | sí | sí | no | no |
| Menú, promociones, favoritas y fotos | sí | sí | no | no |
| Restablecer el menú inicial | sí | no | no | no |
| Resumen de ventas | sí | no | no | no |
| Registrar usuarios, cambiar perfil, activar/desactivar | sí | no | no | no |

- **Historial de pedidos (admin):** en **Resumen**, debajo de las gráficas, está el historial con **todos los pedidos de cualquier día** (entregados, en proceso y cancelados): búsqueda, periodo, estado y un día en concreto; se agrupan por día, se abren para ver teléfono, dirección y productos, y con "Cargar pedidos más antiguos" se traen más allá de los 500 que llegan en vivo.
- **En el teléfono** el panel usa un **menú inferior** (Pedidos, Resumen, Menú, Ingredientes, Usuarios según el perfil; con insignia de pedidos nuevos) y una cabecera compacta; el correo, el sonido, los avisos y Salir están en el botón de cuenta. En pantallas grandes siguen las pestañas de arriba.
- Los pedidos por atender (nuevo, preparando, en camino) salen siempre **del más viejo al más nuevo**, de cualquier día; después los ya atendidos, del más reciente al más antiguo.
- **Repartidores:** al pasar un pedido de "preparando" a "en camino" el panel abre la lista de repartidores activos para elegir quién lo lleva (o "Sin repartidor" si lo entrega la tienda). El pedido guarda `repartidorUid` y `repartidorNombre`. El repartidor solo ve su lista de pedidos por entregar (con teléfono, dirección en el mapa y notas), recibe un aviso cuando le asignan uno y lo marca como **entregado**; entonces sale de su lista. La tienda y el admin pueden cambiar de repartidor mientras el pedido va en camino.
- El personal entra con **teléfono + contraseña** (Firebase Authentication; internamente `<10 dígitos>@admin.anonimus.pizza`). El administrador original también puede entrar con Google. Ni teléfonos ni contraseñas están en el código.
- Un perfil `activo: false` no tiene ningún acceso. No se puede desactivar la propia cuenta ni al último admin.
- El panel usa su **propia sesión** de Firebase (app "admin"), separada de la de los clientes; las cuentas `@admin.anonimus.pizza` no pueden registrarse ni entrar como clientes.

## Ingredientes de "Arma tu pizza" (panel → Ingredientes)

Admin y tienda pueden **agregar, ocultar, quitar y cambiar la foto** de los ingredientes que el cliente elige (los 12 originales traen sus fotos recortadas). Cada ingrediente tiene nombre, tipo (carne o verdura/fruta, para ordenar las capas), cantidad y tamaño de piezas en la pizza.

- **Fondo transparente siempre:** al subir una foto, el navegador **quita el fondo** (parte del borde y avanza por los tonos parecidos al color de fondo), recorta el sobrante y la guarda como WebP con transparencia. Hay un control de **sensibilidad** y una vista previa sobre cuadritos; si la imagen ya es un PNG sin fondo se usa tal cual. Funciona mejor con fondo liso (blanco); con fondos complicados pueden quedar restos y conviene subir un PNG sin fondo.
- **Dónde se guardan:** en `config/ingredientes` (`lista`, `imagenes` y `version`), aparte de las fotos del menú. Máximo **40 ingredientes** y **24 fotos propias** (cada una ≤ 28 000 caracteres); las reglas lo exigen. La tienda lee la lista junto con el menú y descarga las imágenes solo cuando cambia `version`.
- Un ingrediente nuevo se dibuja sobre la pizza con su imagen (girada y repartida al azar); los de fábrica conservan sus piezas hasta que se les cambia la foto ("Volver a la original" las restaura).
- El nombre no se edita (las especialidades lo usan): para otro nombre se agrega uno nuevo y se quita el anterior. Si se oculta o quita un ingrediente, las especialidades que lo usan simplemente lo omiten.

## Avisos de pedidos nuevos en el teléfono

El panel se puede **instalar en la pantalla de inicio** (Android: menú del navegador → *Instalar app*; iPhone: Compartir → *Agregar a pantalla de inicio*, iOS 16.4 o superior). Cada persona del panel (admin, tienda o empleado) toca **Activar avisos** y acepta el permiso: desde entonces, cada pedido nuevo muestra una **notificación del sistema** y, al tocarla, se abre el panel en ese pedido (`/admin?pedido=ID`). Los clientes no reciben nada.

- **Límite (plan gratuito):** no hay servidor que envíe avisos (eso pide Cloud Functions y el plan Blaze). Las notificaciones las dispara el propio panel al recibir el pedido en vivo, así que llegan **mientras la app esté abierta o en segundo plano**, no con la app cerrada del todo o el teléfono bloqueado un rato largo. Con los avisos activos el panel pide mantener la pantalla encendida mientras está a la vista.
- Con el panel a la vista solo suena y se muestra el aviso en pantalla (sin notificación duplicada).
- Archivos: `public/sw.js` (service worker), `public/admin.webmanifest` y los íconos `public/icono-*.png`.

## Tecnología

- **Vue 3** (`<script setup>`) + **vue-router 4** (rutas con carga diferida) + **Vite 6**, JavaScript.
- **Firebase** (SDK 11): Authentication, Firestore, Hosting. Sin Cloud Functions ni Storage (requieren plan de pago).
- La tienda lee `config/*` por **REST** (sin cargar el SDK) y guarda copias en `localStorage`.
- Vista previa de la pizza en `<canvas>` con atlas de sprites (`public/img/sprites`).

## Estructura

```
src/
  views/        Home, Especialidades, Paquetes, Adicionales, ArmaPizza, Carrito, Ticket, Perfil, Admin
  components/   Icono (set de íconos), PizzaPreview, ProductoCard, AdminMenu, AdminUsuarios, TicketPedido…
  firebase/     claves (config pública), auth/db (clientes), admin (sesión del panel), pedidos, config
  store/        cart, menu, historial, toast
  data/         menu.js (menú inicial), imagenes.js
  utils/        imagen.js (recorte/compresión de fotos), iconos.js
public/img/     logo, base de pizza, fotos, sprites de ingredientes
tests/          pruebas de las reglas de Firestore
tools/          procesar-imagenes.py (genera sprites)
firestore.rules reglas de seguridad
```

## Desarrollo local

Requiere Node 22.

```bash
npm install
npm run dev        # servidor local (http://localhost:5173)
npm run build      # compila a dist/
npm run preview    # sirve dist/
npm run test:rules # pruebas de las reglas con el emulador (necesita Java)
```

Sin conexión a Firestore la tienda usa el menú inicial de `src/data/menu.js`.

## Configurar Firebase (una sola vez)

1. **Authentication → Método de acceso:** activar *Correo electrónico/contraseña* y *Google*. En *Dominios autorizados* debe estar el dominio de la tienda.
2. **Primer administrador:** en *Authentication → Usuarios → Agregar usuario* crear `TELEFONO@admin.anonimus.pizza` con su contraseña y copiar el **UID**. En *Firestore → colección `admins`* crear el documento con ese UID y el campo `nombre` (un perfil sin `rol` cuenta como admin).
3. **Los demás usuarios** se registran desde el panel → **Usuarios** (nombre, teléfono, contraseña y perfil). Para cambiar la contraseña de alguien: borrarlo en Authentication y registrarlo de nuevo.
4. La configuración web de Firebase (`src/firebase/claves.js`) es pública por diseño; **nunca** se guardan llaves privadas, contraseñas ni datos personales en el repositorio.

## Datos (Firestore)

| Colección / documento | Contenido | Quién escribe |
|---|---|---|
| `pedidos/{id}` | pedido: datos de entrega, `items`, `total`, `estado`, `uid` opcional, y al ir en camino `repartidorUid`/`repartidorNombre` | cualquiera crea; personal actualiza según perfil; **nadie borra** |
| `admins/{uid}` | `nombre`, `telefono`, `rol` (`admin`/`tienda`/`empleado`/`repartidor`), `activo` | admin |
| `config/menu` | `items[]` (todo el menú) y `fotosVersion` | admin / tienda |
| `config/fotos` | `fotos` (id → imagen WebP en data URL) y `version` | admin / tienda |
| `config/ingredientes` | `lista` (ingredientes de Arma tu pizza), `imagenes` (id → WebP transparente) y `version` | admin / tienda |

- `config/*` es de lectura pública. Un cliente solo lee **sus** pedidos (consulta por `uid`, sin índices); un pedido sin dueño puede ser reclamado una sola vez por una cuenta.
- **Pedidos cancelados** no cuentan en las ventas.

## Fotos y topes

Firebase Storage exige plan de pago, así que las fotos se guardan **dentro de Firestore**: se recortan cuadradas y se comprimen en el navegador (≈30 KB, WebP).

- Máximo **20 fotos subidas** (lo exigen las reglas) y **20 entre especialidades y paquetes** (lo controla el panel). Al llegar al tope se pide borrar alguna.
- La tienda descarga las fotos solo cuando cambia `fotosVersion`; el resto de las visitas usa la copia local, para cuidar la cuota gratuita (50 000 lecturas/día en Firestore).
- Sin foto, cada producto muestra un **ícono** elegido en el panel (pizza, calzone, refresco, etc.).

## Despliegue

Cada push a `main` ejecuta `.github/workflows/firebase-hosting.yml`: instala, compila y publica **Hosting** y las **reglas de Firestore** en el proyecto `anonimus-pizza`.

- Autenticación **sin llaves**: Workload Identity Federation. Se configuran dos variables del repositorio (*Settings → Secrets and variables → Actions → Variables*): `GCP_WIF_PROVIDER` y `GCP_SERVICE_ACCOUNT`.
- Si el despliegue falla con "Failed to authenticate", revisa que la cuenta de servicio tenga sus roles y el enlace `workloadIdentityUser`, y vuelve a lanzar el workflow.
- Flujo de trabajo: rama de trabajo → Pull Request → squash merge a `main` → comprobar que la acción de despliegue termine en verde.

## Herramientas

`tools/procesar-imagenes.py` (necesita Pillow y numpy) genera la base de pizza y los atlas de sprites de ingredientes a partir de las imágenes originales de la app de Android; el resultado ya está en `public/img/`.

## Límites conocidos

- Verificado con emulador y pruebas automáticas; el acceso con Google de clientes, la subida de fotos con la cámara de un teléfono real y el bloqueo de zoom en iOS Safari conviene probarlos en el proyecto real.
- Revisa en la consola de Firebase los límites vigentes de Authentication y la cuota de Firestore de tu plan.
