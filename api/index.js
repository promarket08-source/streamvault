const mercadopago = require('mercadopago');

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || 'APP_USR-3995262250590857-041417-92ce2fd7714a6307d97784ed02a87435-1203544880';
const BASE_URL = process.env.BASE_URL || `https://${process.env.VERCEL_URL}`;

const mp = new mercadopago.MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN });

const PRODUCTS = {
    'pack-peliculas': { name: 'PACK PELÍCULAS', price: 3990 },
    'pack-anime-series': { name: 'PACK ANIME & SERIES', price: 3990 },
    'pack-comics': { name: 'PACK COMICS & MANGA', price: 2990 },
    'pack-musica': { name: 'PACK MÚSICA', price: 1990 },
    'pack-libros': { name: 'PACK LIBROS', price: 2490 },
    'pack-total': { name: 'PACK COMPLETO', price: 15990 }
};

module.exports = async function(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    const path = req.url || '';
    
    // Health check
    if (path === '/health' || path === '/health/') {
        return res.json({ status: 'ok', timestamp: new Date().toISOString() });
    }
    
    // Create preference endpoint
    if (path === '/' || path === '') {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed. Use POST.' });
        }
        
        const { email, phone, productId } = req.body || {};
        
        if (!email || !phone) {
            return res.status(400).json({ error: 'Faltan email o phone' });
        }
        
        const product = PRODUCTS[productId] || PRODUCTS['pack-total'];
        
        try {
            const preference = {
                items: [{
                    title: product.name,
                    description: 'Contenido digital StreamVault',
                    quantity: 1,
                    currency_id: 'CLP',
                    unit_price: product.price
                }],
                payer: { email, phone: { number: phone } },
                external_reference: Date.now().toString(),
                notification_url: `${BASE_URL}/api/webhook`,
                back_urls: {
                    success: `${BASE_URL}/success.html`,
                    failure: `${BASE_URL}/failure.html`,
                    pending: `${BASE_URL}/pending.html`
                }
            };
            
            const response = await mp.preferences.create(preference);
            
            return res.json({ 
                init_point: response.body.init_point,
                preference_id: response.body.id
            });
        } catch (error) {
            console.error('MP Error:', error);
            return res.status(500).json({ error: error.message });
        }
    }
    
    // Webhook endpoint
    if (path === '/webhook' || path === '/webhook/') {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed' });
        }
        
        const payment = req.body;
        
        if (payment.type === 'payment') {
            const paymentData = await mp.payment.findById({ id: payment.data.id });
            const status = paymentData.body.status;
            
            console.log('Payment status:', status);
        }
        
        return res.json({ received: true });
    }
    
    res.status(404).json({ error: 'Not found' });
}