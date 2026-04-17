const express = require('express');
const mercadopago = require('mercadopago');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
app.use(express.json());

// CORS configurado para Netlify
app.use(cors({
    origin: process.env.ALLOWED_ORIGIN || '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.static(path.join(__dirname, '..')));

// CONFIGURACIÓN
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || 'TEST-3995262250590857-041417-517c4813229810d837a479d0063af4cf-1203544880';
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || '';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'secret-key-123';

mercadopago.configurations.setAccessToken(MP_ACCESS_TOKEN);

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
        
        const response = await mercadopago.preferences.create(preference);
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
            const paymentData = await mercadopago.payment.findById(payment.data.id);
            const paymentStatus = paymentData.body.status;
            const paymentId = paymentData.body.external_reference;
            
            console.log(`📦 Payment ${paymentId}: ${paymentStatus}`);
            
            const tokenData = accessTokens.get(paymentId);
            
            if (tokenData && paymentStatus === 'approved') {
                tokenData.status = 'approved';
                accessTokens.set(paymentId, tokenData);
                
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
});

