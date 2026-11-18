# Anonimus-Pizza-web
App Web para hacer pedidos de pizzas a domicilio personalizadas,  con entregas  y gestion de del dia

## Panel de administración (`/admin`)

Acceso con **teléfono + contraseña** (Firebase Authentication) o con Google. Ni el teléfono ni la contraseña están en el código.

Para crear un administrador (una sola vez, desde la consola de Firebase):

1. **Authentication → Método de acceso:** activar **Correo electrónico/contraseña**.
2. **Authentication → Usuarios → Agregar usuario:** correo `TELEFONO@admin.anonimus.pizza` (el teléfono de 10 dígitos) y la contraseña elegida. Copiar el **UID** del usuario.
3. **Firestore Database → Iniciar colección:** `admins`, ID del documento = ese UID, con un campo `nombre` (texto).
4. Entrar en `/admin` con el teléfono y la contraseña.

Las reglas (`firestore.rules`) solo dejan leer, editar o borrar pedidos a quien esté en `admins` (o al correo de Google autorizado). Nadie puede agregarse a `admins` desde la página.

Pruebas de las reglas: `npm run test:rules` (necesita Java).

## Menú editable desde el panel

En `/admin` → pestaña **Menú** se agregan, editan, ocultan, duplican, ordenan y borran **especialidades, paquetes y adicionales**; se marcan **favoritas** (carrusel del inicio) y se ponen **promociones** (precio rebajado, con el precio normal tachado). Las fotos se eligen de la biblioteca incluida o con una dirección `https://`.

- Todo el menú vive en **un solo documento** de Firestore (`config/menu`): la tienda lo lee con 1 lectura por visita (por REST, sin cargar el SDK) y guarda una copia local.
- Si el documento no existe o no hay conexión, la tienda usa el menú inicial de `src/data/menu.js` (`MENU_INICIAL`).
- Las reglas dejan leerlo a cualquiera y escribirlo solo a un administrador.
- "Restablecer el menú inicial" en el panel devuelve los datos de `MENU_INICIAL`.

## Perfil de clientes (`/perfil`)

Los clientes pueden crear una cuenta (correo y contraseña, o Google) para ver sus **pedidos y tickets** del más reciente al más antiguo, agrupados por día, y seguir el estado de cada pedido en vivo (Recibido → Preparando → En camino → Entregado).

- Con sesión iniciada, cada pedido nuevo se guarda con el `uid` de la cuenta. Las reglas dejan leer un pedido solo al administrador o a su dueño; nadie puede editarlo ni borrarlo (solo el admin). La consulta del perfil filtra por `uid` sin ordenar en el servidor (se ordena en el navegador), así que **no hace falta ningún índice**.
- Quien compra sin cuenta ve en su perfil los pedidos hechos **en ese dispositivo** (guardados solo en su navegador), con el estado "Enviado". Los pedidos hechos antes de iniciar sesión no se pasan a la cuenta.
- Para activar los accesos: **Authentication → Método de acceso** → Correo/contraseña y Google; y en **Dominios autorizados** el dominio de la tienda.
