const express = require('express');
const mercadopago = require('mercadopago');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============ TELEGRAM BOT CONFIG ============
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8754625349:AAFi4gNbjvm-vPfvkJX2wkwHAEkfglmbEL4';
const TELEGRAM_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID || '1811224365';
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyANLfnUXrtLKBMQWwUs7wGbbUSrwIq5eQo';
const FIREBASE_DB_URL = process.env.FIREBASE_DB_URL || 'https://emprende-online-a8469.firebaseio.com';

let botEnabled = true; // Por defecto activado

// Chat sessions - para manejar conversaciones activas
const chatSessions = new Map();
// false = bot contestando, true = admin controllando
const adminActiveChats = new Map(); 

// Variables para reportes
let ventasHoy = 0;
let leadsHoy = 0; 

// Función para enviar mensaje a Telegram
async function sendToTelegram(chatId, text) {
    if (!TELEGRAM_BOT_TOKEN) return;
    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML'
        });
    } catch (e) {
        console.error('Telegram error:', e.message);
    }
}

// Función para enviar mensaje al cliente desde el admin
async function sendToClient(sessionId, text) {
    const session = chatSessions.get(sessionId);
    if (!session || !session.clientToken) return;
    
    try {
        await axios.post(`${session.webhookUrl}/send`, {
            token: session.clientToken,
            message: text
        });
    } catch (e) {
        console.error('Error sending to client:', e.message);
    }
}

// ============ RESPUESTAS AUTOMÁTICAS DEL BOT ============
const BOT_RESPONSES = {
    'hola': '¡Hola! 👋 Bienvenido a StreamVault. ¿En qué puedo ayudarte hoy? Puedo informarte sobre nuestros packs, precios o cómo realizar una compra.',
    'precio': 'Nuestros precios son:\n📽️ Pack Películas: $3.990\n📺 Pack Anime/Series: $3.990\n📚 Pack Cómics: $2.990\n🎵 Pack Música: $1.990\n📖 Pack Libros: $2.490\n🎬 Pack Completo: $7.990 (ahorra $6.470!)',
    'precios': 'Nuestros precios son:\n📽️ Pack Películas: $3.990\n📺 Pack Anime/Series: $3.990\n📚 Pack Cómics: $2.990\n🎵 Pack Música: $1.990\n📖 Pack Libros: $2.490\n🎬 Pack Completo: $7.990 (ahorra $6.470!)',
    'comprar': '¡Perfecto! Para comprar, haz clic en el pack que quieras y completa el formulario de pago con MercadoPago. ¿Cuál pack te interesa?',
    'pago': 'Aceptamos MercadoPago. Puedes pagar con tarjeta de crédito, débito o transferencia. El proceso es 100% seguro.',
    'mercado': 'Aceptamos MercadoPago. Puedes pagar con tarjeta de crédito, débito o transferencia. El proceso es 100% seguro.',
    'drive': 'Todo el contenido está en Google Drive. Una vez aprobado el pago, te enviamos los enlaces directos a tu correo.',
    'contenido': 'Tenemos +500 películas, +300 series/anime, cómics Marvel/DC/Manga, música y +100 libros. ¿Qué tipo de contenido te interesa?',
    'anime': '¡Sí! Tenemos anime subtitulado y doblado. Incluye series completas de Naruto, One Piece, Attack on Titan y muchas más.',
    'peliculas': 'Incluye +500 películas en 4K y HD. Acción, comedia, terror, drama, sagas completas como Marvel, DC, Star Wars y más.',
    'comics': 'Tenemos cómics de Marvel, DC, Manga (One Piece, Dragon Ball, Naruto) y más. Miles de títulos en PDF.',
    'musica': 'Incluye música de DJ Nicolas Escobar y más. Mezclas, singles y albums exclusivos.',
    'libros': '+100 libros y audiolibros enPDF. Bestsellers, clásico, desarrollo personal y más.',
    'gracias': '¡De nada! 😊 ¿Hay algo más en lo que pueda ayudarte?',
    'gracias': '¡De nada! 😊 ¿Hay algo más en lo que pueda ayudarte?',
    'default': 'Gracias por tu mensaje. Un agente revisará tu consulta pronto. Si es urgente, puedes escribirnos directamente.'
};

function getBotResponse(message) {
    const lower = message.toLowerCase();
    for (const [key, response] of Object.entries(BOT_RESPONSES)) {
        if (lower.includes(key)) return response;
    }
    return BOT_RESPONSES['default'];
}

// CORS configurado para Netlify
app.use(cors({
    origin: process.env.ALLOWED_ORIGIN || '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// CONFIGURACIÓN
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || 'APP_USR-3995262250590857-041417-92ce2fd7714a6307d97784ed02a87435-1203544880';
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || '';
const BASE_URL = process.env.BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'secret-key-123';

// Configurar MercadoPago
const mp = new mercadopago.MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN });

// Map de productos con sus folders de Drive
const PRODUCTS = {
    'pack-peliculas': {
        name: 'PACK PELÍCULAS',
        price: 3990,
        description: 'Acceso a +500 películas en 4K y HD',
        folderId: '1cc0Z_G5RAqJneyocZ7cIyCr-H-6gIOkp',
        folderUrl: 'https://drive.google.com/drive/folders/1cc0Z_G5RAqJneyocZ7cIyCr-H-6gIOkp'
    },
    'pack-anime-series': {
        name: 'PACK ANIME & SERIES',
        price: 3990,
        description: 'Acceso a +300 series completas',
        folderId: '19PVC5_DwAKmnjPQwUeWNBkjcDuXBDdm6',
        folderUrl: 'https://drive.google.com/drive/folders/19PVC5_DwAKmnjPQwUeWNBkjcDuXBDdm6'
    },
    'pack-comics': {
        name: 'PACK COMICS & MANGA',
        price: 2990,
        description: 'Acceso a Comics Marvel, DC y Manga',
        folderId: '1yrth6NyK9iO7nQmiQCmB2BmvpLsh9YBV',
        folderUrl: 'https://drive.google.com/drive/folders/1yrth6NyK9iO7nQmiQCmB2BmvpLsh9YBV'
    },
    'pack-musica': {
        name: 'PACK MÚSICA',
        price: 1990,
        description: 'Acceso a DJ Nicolas Escobar y más',
        folderId: '1tjm_CdRMehl3Mao2u_seGLrKpVM03TTt',
        folderUrl: 'https://drive.google.com/drive/folders/1tjm_CdRMehl3Mao2u_seGLrKpVM03TTt'
    },
    'pack-libros': {
        name: 'PACK LIBROS & AUDIOLIBROS',
        price: 2490,
        description: 'Acceso a +100 libros y audiolibros',
        folderId: '1eNIi91KWHTQur90rhSM5vevtIsgC_jsq',
        folderUrl: 'https://drive.google.com/drive/folders/1eNIi91KWHTQur90rhSM5vevtIsgC_jsq'
    },
    'pack-completo': {
        name: 'PACK COMPLETO StreamVault',
        price: 7990,
        description: 'Acceso a TODOS los enlaces de Drive',
        folderId: 'all',
        folderUrl: null // Se muestran todos los links
    },
    'pack-total': {
        name: 'PACK TOTAL StreamVault',
        price: 15990,
        description: 'Acceso TOTAL a todo el contenido + bonuses exclusivos',
        folderId: 'all',
        folderUrl: null
    }
};

// Acceso tokens para compradores (en producción usar base de datos)
const accessTokens = new Map();

// Crear preferencia de pago
app.post('/api/create-preference', async (req, res) => {
    const { email, phone, productId, productName, price, folderId } = req.body;
    
    if (!email || !phone) {
        return res.status(400).json({ error: 'Faltan datos requeridos' });
    }
    
    // Obtener datos del producto
    const product = PRODUCTS[productId] || {
        name: productName || 'Producto StreamVault',
        price: price || 1000,
        description: 'Acceso digital',
        folderId: folderId,
        folderUrl: folderId ? `https://drive.google.com/drive/folders/${folderId}` : null
    };
    
    // Generar token de acceso único
    const accessToken = crypto.randomBytes(32).toString('hex');
    const paymentId = crypto.randomBytes(16).toString('hex').toUpperCase();
    
    // Guardar token pendiente (se activa cuando pague)
    accessTokens.set(paymentId, {
        email,
        phone,
        productId,
        productName: product.name,
        price: product.price,
        folderId: product.folderId,
        folderUrl: product.folderUrl,
        accessToken,
        status: 'pending',
        createdAt: new Date()
    });
    
    try {
        const preference = {
            items: [
                {
                    title: product.name,
                    description: product.description,
                    quantity: 1,
                    currency_id: 'CLP',
                    unit_price: product.price
                }
            ],
            payer: {
                email: email,
                phone: { number: phone }
            },
            external_reference: paymentId,
            notification_url: `${BASE_URL}/server/api/webhook`,
            back_urls: {
                success: `${BASE_URL}/success.html?payment=${paymentId}`,
                failure: `${BASE_URL}/failure.html`,
                pending: `${BASE_URL}/pending.html`
            }
        };
        
        const response = await mp.preferences.create(preference);
        res.json({ 
            init_point: response.body.init_point, 
            preference_id: response.body.id,
            payment_id: paymentId
        });
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al crear preferencia' });
    }
});

// Verificar si el pago fue aprobado
app.get('/api/verify-payment/:paymentId', async (req, res) => {
    const { paymentId } = req.params;
    const token = accessTokens.get(paymentId);
    
    if (!token) {
        return res.status(404).json({ error: 'Pago no encontrado' });
    }
    
    if (token.status === 'approved') {
        // Si es pack completo, devolver todos los links
        if (token.folderId === 'all') {
            res.json({ 
                approved: true, 
                accessToken: token.accessToken,
                productName: token.productName,
                link: token.folderUrl,
                links: {
                    peliculas: 'https://drive.google.com/drive/folders/1cc0Z_G5RAqJneyocZ7cIyCr-H-6gIOkp',
                    animeSeries: 'https://drive.google.com/drive/folders/19PVC5_DwAKmnjPQwUeWNBkjcDuXBDdm6',
                    comics: 'https://drive.google.com/drive/folders/1yrth6NyK9iO7nQmiQCmB2BmvpLsh9YBV',
                    historietas: 'https://drive.google.com/drive/folders/1Gny7qO30-nCP76IXi6iwZ5lLmEEehz3L',
                    musica: 'https://drive.google.com/drive/folders/1tjm_CdRMehl3Mao2u_seGLrKpVM03TTt',
                    libros: 'https://drive.google.com/drive/folders/1eNIi91KWHTQur90rhSM5vevtIsgC_jsq'
                }
            });
        } else {
            // Devolver solo el link del pack comprado
            res.json({ 
                approved: true, 
                accessToken: token.accessToken,
                productName: token.productName,
                link: token.folderUrl,
                links: null
            });
        }
    } else {
        res.json({ approved: false, status: token.status });
    }
});

// Verificar access token
app.get('/api/access/:token', (req, res) => {
    const { token } = req.params;
    
    for (const [paymentId, data] of accessTokens) {
        if (data.accessToken === token && data.status === 'approved') {
            return res.json({ 
                valid: true,
                links: {
                    peliculas: 'https://drive.google.com/drive/folders/1cc0Z_G5RAqJneyocZ7cIyCr-H-6gIOkp',
                    animeSeries: 'https://drive.google.com/drive/folders/19PVC5_DwAKmnjPQwUeWNBkjcDuXBDdm6',
                    comics: 'https://drive.google.com/drive/folders/1yrth6NyK9iO7nQmiQCmB2BmvpLsh9YBV',
                    historietas: 'https://drive.google.com/drive/folders/1Gny7qO30-nCP76IXi6iwZ5lLmEEehz3L',
                    musica: 'https://drive.google.com/drive/folders/1tjm_CdRMehl3Mao2u_seGLrKpVM03TTt',
                    libros: 'https://drive.google.com/drive/folders/1eNIi91KWHTQur90rhSM5vevtIsgC_jsq'
                }
            });
        }
    }
    
    res.status(403).json({ valid: false, error: 'Token inválido o acceso no pagado' });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Webhook para notificaciones de pago
app.post('/api/webhook', async (req, res) => {
    const payment = req.body;
    
    if (payment.type === 'payment') {
        try {
            const paymentData = await mp.payment.findById({ id: payment.data.id });
            const paymentStatus = paymentData.body.status;
            const paymentId = paymentData.body.external_reference;
            
            console.log(`📦 Payment ${paymentId}: ${paymentStatus}`);
            
            const tokenData = accessTokens.get(paymentId);
            
            if (tokenData && paymentStatus === 'approved') {
                tokenData.status = 'approved';
                accessTokens.set(paymentId, tokenData);
                ventasHoy += tokenData.price;
                
                console.log('✅ PAGO APROBADO - Activando:', tokenData.productName);
                
                // Notificar a n8n
                if (N8N_WEBHOOK_URL) {
                    try {
                        await axios.post(N8N_WEBHOOK_URL, {
                            event: 'payment_approved',
                            email: tokenData.email,
                            phone: tokenData.phone,
                            productName: tokenData.productName,
                            price: tokenData.price,
                            accessToken: tokenData.accessToken,
                            folderUrl: tokenData.folderUrl
                        });
                        console.log('📨 Notificación enviada a n8n');
                    } catch (e) {
                        console.error('Error n8n:', e.message);
                    }
                }
                
                // WhatsApp a Roberto
                const adminMsg = encodeURIComponent(
                    `💰 *NUEVA VENTA - StreamVault*\n\n` +
                    `📦: ${tokenData.productName}\n` +
                    `📧: ${tokenData.email}\n` +
                    `📱: ${tokenData.phone}\n` +
                    `💵: $${tokenData.price.toLocaleString('es-CL')} CLP`
                );
                console.log(`📱 https://api.whatsapp.com/send?phone=56964681874&text=${adminMsg}`);
            }
        } catch (error) {
            console.error('Error webhook:', error);
        }
    }
    
    res.status(200).send('OK');
});

// Página de acceso (muestra link del pack comprado)
app.get('/access', (req, res) => {
    const { id } = req.query;
    const token = accessTokens.get(id);
    
    if (!token || token.status !== 'approved') {
        return res.send(`
            <h1>Acceso denegado</h1>
            <p>El pago no ha sido verificado o el enlace es inválido.</p>
        `);
    }
    
    const links = {
        'pack-peliculas': '📽️ PACK PELÍCULAS',
        'pack-anime-series': '📺 PACK ANIME & SERIES',
        'pack-comics': '📚 PACK COMICS & MANGA',
        'pack-musica': '🎵 PACK MÚSICA',
        'pack-libros': '📖 PACK LIBROS',
        'pack-completo': '🎬 PACK COMPLETO'
    };
    
    res.send(`
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Acceso Confirmado - StreamVault</title>
            <style>
                body { font-family: Arial; background: #0a0a0a; color: #fff; padding: 40px; text-align: center; }
                .container { max-width: 500px; margin: 0 auto; }
                .btn { display: inline-block; background: #10b981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-size: 18px; margin: 10px; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>✅ Pago Confirmado</h1>
                <h2>${token.productName}</h2>
                <p>Tu pago de $${token.price.toLocaleString('es-CL')} CLP fue aprobado.</p>
                <br>
                <a href="${token.folderUrl}" class="btn">🔗 ACCEDER AHORA</a>
                <br><br>
                <p style="color: #888;">Guarda este enlace para futuras visitas.</p>
            </div>
        </body>
        </html>
    `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 MercadoPago configured`);
    if (botEnabled) {
        console.log(`📱 Telegram Bot enabled`);
    }
});

// ============ TELEGRAM BOT WEBHOOK ============
// Webhook para recibir mensajes de Telegram
app.post('/api/telegram/webhook', async (req, res) => {
    const { message } = req.body;
    
    if (!message || !message.text) {
        return res.status(200).send('OK');
    }
    
    const chatId = message.chat.id.toString();
    const text = message.text;
    
    console.log(`📱 Telegram: ${chatId} - ${text}`);
    
    // Buscar si es el admin
    if (chatId === TELEGRAM_ADMIN_CHAT_ID) {
        // Es el admin - buscar si hay una sesión activa
        if (text.startsWith('/responder ')) {
            // Formato: /responder mensaje
            const parts = text.replace('/responder ', '').split(' ');
            const sessionId = parts[0];
            const responseMsg = parts.slice(1).join(' ');
            
            if (sessionId && responseMsg) {
                await sendToClient(sessionId, responseMsg);
                await sendToTelegram(chatId, '✅ Respuesta enviada al cliente');
            }
        } else if (text === '/chats') {
            // Ver chats activos
            let msg = '📱 Chats activos:\n';
            for (const [sessionId, session] of chatSessions) {
                msg += `- ${sessionId}: ${session.lastMessage.substring(0, 30)}...\n`;
            }
            await sendToTelegram(chatId, msg || 'No hay chats activos');
        } else if (text === '/bot on') {
            botEnabled = true;
            await sendToTelegram(chatId, '✅ Bot habilitado');
        } else if (text === '/bot off') {
            botEnabled = false;
            await sendToTelegram(chatId, '❌ Bot deshabilitado');
        } else if (adminActiveChats.has(chatId)) {
            // Responder al chat activo
            const sessionId = adminActiveChats.get(chatId);
            await sendToClient(sessionId, text);
            await sendToTelegram(chatId, '✅ Respuesta enviada');
        }
        return res.status(200).send('OK');
    }
    
    // Es un cliente - crear/actualizar sesión
    const sessionId = `chat_${Date.now()}`;
    
    // Guardar sesión
    chatSessions.set(sessionId, {
        chatId: chatId,
        lastMessage: text,
        createdAt: new Date()
    });
    
    // Notificar al admin
    if (TELEGRAM_ADMIN_CHAT_ID) {
        const notifyMsg = `💬 <b>Nuevo mensaje</b>\n\n` +
            `Cliente: ${chatId}\n` +
            `Mensaje: ${text}\n\n` +
            `Responde: /responder ${sessionId} TU RESPUESTA`;
        
        await sendToTelegram(TELEGRAM_ADMIN_CHAT_ID, notifyMsg);
    }
    
    // Responder automáticamente con el bot (si está habilitado)
    if (botEnabled) {
        setTimeout(async () => {
            const response = getBotResponse(text);
            await sendToTelegram(chatId, response);
        }, 3000); // 3 segundos de delay
    }
    
    res.status(200).send('OK');
});

// Endpoint para iniciar chat desde la web
app.post('/api/chat/start', (req, res) => {
    const { sessionId, webhookUrl, clientToken } = req.body;
    
    if (!sessionId || !webhookUrl) {
        return res.status(400).json({ error: 'Faltan datos requeridos' });
    }
    
    // Guardar referencia para poder responder
    chatSessions.set(sessionId, {
        webhookUrl,
        clientToken: clientToken || null,
        lastMessage: '',
        createdAt: new Date()
    });
    
    res.json({ success: true });
});

// API para verificar estado del bot
app.get('/api/bot/status', (req, res) => {
    res.json({ 
        enabled: botEnabled,
        activeChats: chatSessions.size
    });
});

// API para admin - cambiar estado del bot
app.post('/api/bot/toggle', (req, res) => {
    const { enabled } = req.body;
    if (typeof enabled === 'boolean') {
        botEnabled = enabled;
    }
    res.json({ enabled: botEnabled });
});

// ============ WEB CHAT ENDPOINT ============
app.post('/api/chat/web', async (req, res) => {
    const { message, sessionId } = req.body;
    
    if (!message) {
        return res.status(400).json({ error: 'Mensaje requerido' });
    }
    
    console.log(`💬 Web Chat: ${sessionId} - ${message}`);
    
    // Guardar en CRM (Firebase)
    try {
        await axios.post(`${FIREBASE_DB_URL}/conversaciones.json`, {
            sessionId,
            mensaje: message,
            origen: 'web',
            fecha: new Date().toISOString()
        });
    } catch (e) {
        console.log('CRM: modo local');
    }
    
    // Notificar a admin por Telegram
    const notifyMsg = `💬 <b>Nuevo mensaje WEB</b>\n\n` +
        `Sesión: ${sessionId}\n` +
        `Mensaje: ${message}\n\n` +
        `<i>Responde desde tu Telegram</i>`;
    await sendToTelegram(TELEGRAM_ADMIN_CHAT_ID, notifyMsg);
    
    // Responder con bot (3 segundos delay)
    setTimeout(async () => {
        const response = getBotResponse(message);
        
        // Guardar respuesta
        try {
            await axios.post(`${FIREBASE_DB_URL}/conversaciones.json`, {
                sessionId,
                mensaje: response,
                origen: 'bot',
                fecha: new Date().toISOString()
            });
        } catch (e) {}
        
        // Enviar respuesta al cliente (implementar webhook callback)
    }, 3000);
    
    res.json({ response: 'Mensaje recibido. Te responderé en breve.' });
});

// Reporte diario a Telegram
setInterval(async () => {
    const msg = `📊 <b>REPORTE DIARIO - StreamVault</b>\n\n` +
        `💰 Ventas: ${ventasHoy}\n` +
        `💬 Chats: ${chatSessions.size}\n` +
        `🕐 ${new Date().toLocaleString('es-CL')}`;
    await sendToTelegram(TELEGRAM_ADMIN_CHAT_ID, msg);
}, 24 * 60 * 60 * 1000);

