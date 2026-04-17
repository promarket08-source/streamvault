# 📖 Manual de Usuario - StreamVault

## Para Roberto - Agencia Promarket

---

## 🎯 Descripción Rápida

**StreamVault** es tu plataforma de venta de contenido digital. Los clientes pagan $19.990 CLP (o $7.990 con el código especial), y reciben acceso a tus enlaces de Google Drive con películas, series, anime, cómics, música y libros.

---

## 💰 Cambiar Precios

### Cambiar el precio regular

1. Abre el archivo **`index.html`**
2. Busca la línea que dice `const BASE_PRICE = 19990;` (línea ~890)
3. Cambia el número al nuevo precio en CLP:

```javascript
// Ejemplo: cambiar a $25.000 CLP
const BASE_PRICE = 25000;
```

### Cambiar el precio con descuento

1. Busca `const DISCOUNTED_PRICE = 7990;`
2. Cambia el número:

```javascript
// Ejemplo: cambiar a $9.990 CLP
const DISCOUNTED_PRICE = 9990;
```

### Cambiar el código de descuento

1. Busca `const VALID_CODE = 'PACKTODOENUNO';`
2. Cambia el texto entre comillas:

```javascript
// Ejemplo: cambiar a "PROMO2024"
const VALID_CODE = 'PROMO2024';
```

---

## 📁 Agregar/Quitar Contenido

### Agregar películas o series

1. Abre **`index.html`**
2. Busca la sección de "Películas" (busca `section id="peliculas"`)
3. Agrega una nueva fila así:

```html
<div class="item-row flex items-center justify-between py-2 px-3">
    <span>Nombre de la Película</span>
    <span class="quality-badge quality-4k">4K</span>
</div>
```

### Cambiar calidad (4K, HD, SD)

- `quality-4k` = Morado (mejor calidad)
- `quality-hd` = Azul (buena calidad)
- `quality-sd` = Gris (calidad estándar)

### Agregar una nueva categoría

Copia y pega este bloque, cambiando el ID y nombre:

```html
<section id="nueva-categoria" class="py-8 px-6">
    <h2 class="category-header nueva-categoria text-xl font-bold mb-4">Nueva Categoría</h2>
    <div class="space-y-1">
        <!-- Agrega items aquí -->
    </div>
</section>
```

---

## 📱 Cambiar WhatsApp de Contacto

### WhatsApp de ventas (donde reciben mensajes los clientes)

1. Busca `https://wa.me/56964681874`
2. Cámbialo por el nuevo número

**Formato:** `https://wa.me/[numero_sin_signo_mas]`

Ejemplo: Si el número es `+56 9 8765 4321`, queda:
`https://wa.me/56987654321`

### Número en el código del servidor

En **`server/server.js`** línea ~100, busca y cambia:

```javascript
const NOTIFICATION_WHATSAPP = '56964681874';
```

---

## 🔗 Cambiar Enlaces de Google Drive

### En el backend (server.js)

Busca la función `sendWhatsAppNotification` y cambia las URLs:

```javascript
const linksMsg = `...
📽️ Películas: https://drive.google.com/drive/folders/TU_NUEVO_ID
📺 Series: https://drive.google.com/drive/folders/TU_NUEVO_ID
...`;
```

### En success.html

Cambia los enlaces en los botones de acceso:

```html
<a id="linkPeliculas" href="https://drive.google.com/drive/folders/TU_NUEVO_ID">
```

### Obtener nuevos IDs de Drive

1. Ve a Google Drive
2. Abre la carpeta que quieres compartir
3. Copia el ID de la URL (la parte después de `/folders/` o `/d/`)

---

## 📧 Cambiar Email de Contacto

1. Abre **`index.html`**
2. Busca `promarket08@gmail.com`
3. Cámbialo por el nuevo email

---

## 🎨 Cambiar Colores del Diseño

En **`index.html`**, busca la sección `<style>`:

```css
/* Color del botón de compra */
.btn-buy {
    background: linear-gradient(135deg, #10b981, #059669); /* Verde */
}

/* Fondo de la página */
body {
    background: #0a0a0a; /* Negro oscuro */
}
```

### Colores populares

| Color | Código |
|-------|--------|
| Verde esmeralda | `#10b981` |
| Azul | `#3b82f6` |
| Morado | `#8b5cf6` |
| Rojo | `#ef4444` |
| Amarillo | `#eab308` |

---

## 🔧 Cambiar Credenciales de Pago

### MercadoPago Access Token (Backend)

En **`server/server.js`** línea ~15:

```javascript
const MP_ACCESS_TOKEN = 'TU_NUEVO_TOKEN_AQUI';
```

**⚠️ Importante:** En producción, usa variables de entorno en Render.

### MercadoPago Public Key (Frontend)

En **`index.html`** línea ~10:

```javascript
const mp = new MercadoPago('TU_PUBLIC_KEY_AQUI', {
```

---

## 🌐 Cambiar Dominio/URL del Sitio

### En el backend

En **`server/server.js`**:

```javascript
const BASE_URL = 'https://tu-nuevo-dominio.com';
```

### En Netlify

1. Ve a Site Settings → Site Details
2. Clic en "Change site name"
3. Escribe el nuevo nombre

---

## 📊 Ver Ventas

### MercadoPago

1. Ve a https://www.mercadopago.com.uy/activities
2. Ahí verás todas las transacciones

### Consola de Render (Backend)

1. Ve a tu dashboard en Render
2. Clic en tu servicio
3. Revisa los **Logs** para ver ventas en tiempo real

---

## ❓ Preguntas Frecuentes

### ¿Cómo sé si alguien compró?

- **WhatsApp:** Te llega un mensaje automático
- **MercadoPago:** Recibirás un email de notificación
- **Render:** Revisa los logs del servidor

### ¿Qué pasa si el pago no se aprueba?

El cliente verá la página de "pago fallido" y puede reintentar.

### ¿Puedo dar reembolsos?

Sí, desde tu panel de MercadoPago puedes gestionar reembolsos.

### ¿El sistema envía los enlaces automáticamente?

Sí, cuando MercadoPago confirma el pago, el sistema:
1. Activa el acceso
2. Muestra los enlaces en success.html
3. (Opcional) Envía WhatsApp automático via n8n

---

## 🚨 SI NECESITAS AYUDA

**WhatsApp:** +56964681874
**Email:** promarket08@gmail.com

---

## 📋 Checklist de Mantenimiento

- [ ] Revisar weekly las ventas en MercadoPago
- [ ] Verificar que los enlaces de Drive sigan activos
- [ ] Agregar nuevo contenido regularmente
- [ ] Respaldar archivos del sitio

---

## 🔒 Seguridad

- **Nunca compartas** tu Access Token de MercadoPago
- **No subas** `node_modules` a GitHub
- **Mantén actualizado** el código del servidor

---

*Manual creado para Agencia Promarket - StreamVault*
*Última actualización: Abril 2026*
