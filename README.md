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
