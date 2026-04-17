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

// CONFIGURACIÓN - En producción usar variables de entorno
// Para pruebas locales puedes usar las credenciales TEST directamente
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || 'TEST-3995262250590857-041417-517c4813229810d837a479d0063af4cf-1203544880';
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || '';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'secret-key-123';

mercadopago.configurations.setAccessToken(MP_ACCESS_TOKEN);

// Acceso tokens para compradores (en producción usar base de datos)
const accessTokens = new Map();

// Crear preferencia de pago
app.post('/api/create-preference', async (req, res) => {
    const { email, phone, discountCode, price } = req.body;
    
    if (!email || !phone || !price) {
        return res.status(400).json({ error: 'Faltan datos requeridos' });
    }
    
    // Generar token de acceso único
    const accessToken = crypto.randomBytes(32).toString('hex');
    const paymentId = crypto.randomBytes(16).toString('hex').toUpperCase();
    
    // Guardar token pendiente (se activa cuando pague)
    accessTokens.set(paymentId, {
        email,
        phone,
        price,
        code: discountCode,
        accessToken,
        status: 'pending',
        createdAt: new Date()
    });
    
    try {
        const preference = {
            items: [
                {
                    title: 'PACK COMPLETO StreamVault',
                    description: 'Acceso a TODOS los enlaces de Drive - Películas, Series, Anime, Comics, Música, Libros y más',
                    quantity: 1,
                    currency_id: 'CLP',
                    unit_price: price
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
        res.json({ 
            approved: true, 
            accessToken: token.accessToken,
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 MercadoPago configured`);
});

