# ⚙️ Configuración MercadoPago - StreamVault

## 1. Obtener Credenciales

1. Ve a https://www.mercadopago.com.uy/account/credentials
2. Copia tu **ACCESS TOKEN** de producción

## 2. Deploy Backend en Render

1. Crea cuenta en https://render.com
2. Click en **"New +"** → **"Web Service"**
3. Conecta tu repo de GitHub (sube el proyecto completo)
4. Configura:
   - **Name**: `streamvault-api`
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
5. Click en **"Add Environment Variable"** y agrega:
   - `MP_ACCESS_TOKEN` = tu token de MercadoPago
   - `N8N_WEBHOOK_URL` = tu webhook de n8n (opcional)
   - `BASE_URL` = URL de tu sitio en Netlify
   - `ALLOWED_ORIGIN` = URL de Netlify (ej: `https://tu-sitio.netlify.app`)
6. Click en **"Create Web Service"**

## 3. Deploy Frontend en Netlify

1. Ve a https://app.netlify.com/drop
2. Arrastra la carpeta `emprende-digital-pack`
3. Obtén tu URL (ej: `https://random-name.netlify.app`)
4. Actualiza `BASE_URL` en Render con esa URL

## 4. Actualizar Frontend

En `index.html`, cambia el Public Key:

```javascript
// Línea 10, cambia esto:
const mp = new MercadoPago('APP_USR-xxxxxxxx-...', {

// Por tu Public Key de MercadoPago:
const mp = new MercadoPago('APP_USR-TU_PUBLIC_KEY', {
```

## 5. Configurar Webhook en MercadoPago

1. Ve a https://www.mercadopago.com.uy/account/integrations
2. Busca "Webhooks" o "IPN"
3. Configura la URL: `https://streamvault-api.onrender.com/api/webhook`

## 6. Integración n8n (Opcional)

En tu workflow de n8n, crea un webhook que reciba:
```json
{
  "event": "payment_approved",
  "email": "cliente@email.com",
  "phone": "56912345678",
  "price": 7990,
  "accessToken": "abc123..."
}
```

El webhook puede:
- Enviar WhatsApp automático al cliente
- Guardar en Google Sheets
- Enviar email de confirmación
- Agregar a lista de clientes en CRM

## 7. Probar con Tarjetas de Prueba

- **Visa**: 4509 9535 6623 3704
- **Mastercard**: 5031 4332 1540 6351
- **CVV**: 123
- **Vencimiento**: cualquier fecha futura
- **DNI**: 12345678

---

## Estructura de Archivos Final

```
emprende-digital-pack/
├── index.html           # Catálogo con checkout
├── success.html         # Página post-pago (verifica y muestra links)
├── failure.html         # Página de pago fallido
├── server/
│   ├── server.js        # Backend con MercadoPago
│   └── package.json     # Dependencias
├── netlify.toml         # Configuración Netlify
└── MERCADO_PAGO_SETUP.md
```

---

## Flujo Completo

1. Usuario ve catálogo → clic en "COMPRAR AHORA"
2. Modal pide email + WhatsApp
3. Si tiene código `PACKTODOENUNO` → precio baja a $7.990
4. Redirige a MercadoPago
5. Paga con tarjeta (prueba o real)
6. Webhook recibe confirmación → activa acceso
7. Cliente llega a `success.html` → ve sus enlaces
8. Si no pagó aún → ve "pago en proceso"
