const mercadopago = require('mercadopago');
const crypto = require('crypto');

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || 'APP_USR-3995262250590857-041417-92ce2fd7714a6307d97784ed02a87435-1203544880';
const BASE_URL = process.env.BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

const mp = new mercadopago.MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN });

const PRODUCTS = {
    'pack-peliculas': { name: 'PACK PELÍCULAS', price: 3990, description: '+500 películas', folderId: '1cc0Z_G5RAqJneyocZ7cIyCr-H-6gIOkp', folderUrl: 'https://drive.google.com/drive/folders/1cc0Z_G5RAqJneyocZ7cIyCr-H-6gIOkp' },
    'pack-anime-series': { name: 'PACK ANIME & SERIES', price: 3990, description: '+300 series', folderId: '19PVC5_DwAKmnjPQwUeWNBkjcDuXBDdm6', folderUrl: 'https://drive.google.com/drive/folders/19PVC5_DwAKmnjPQwUeWNBkjcDuXBDdm6' },
    'pack-comics': { name: 'PACK COMICS & MANGA', price: 2990, description: 'Cómics y Manga', folderId: '1yrth6NyK9iO7nQmiQCmB2BmvpLsh9YBV', folderUrl: 'https://drive.google.com/drive/folders/1yrth6NyK9iO7nQmiQCmB2BmvpLsh9YBV' },
    'pack-musica': { name: 'PACK MÚSICA', price: 1990, description: 'DJ Nicolas Escobar', folderId: '1tjm_CdRMehl3Mao2u_seGLrKpVM03TTt', folderUrl: 'https://drive.google.com/drive/folders/1tjm_CdRMehl3Mao2u_seGLrKpVM03TTt' },
    'pack-libros': { name: 'PACK LIBROS', price: 2490, description: '+100 libros', folderId: '1eNIi91KWHTQur90rhSM5vevtIsgC_jsq', folderUrl: 'https://drive.google.com/drive/folders/1eNIi91KWHTQur90rhSM5vevtIsgC_jsq' },
    'pack-total': { name: 'PACK COMPLETO', price: 15990, description: 'Todo el contenido', folderId: 'all', folderUrl: null }
};

module.exports = async function(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { email, phone, productId, productName, price, folderId } = req.body;
    
    if (!email || !phone) {
        return res.status(400).json({ error: 'Faltan datos requeridos' });
    }
    
    const product = PRODUCTS[productId] || {
        name: productName || 'Producto StreamVault',
        price: price || 1000,
        description: 'Acceso digital',
        folderId: folderId,
        folderUrl: folderId ? `https://drive.google.com/drive/folders/${folderId}` : null
    };
    
    const paymentId = crypto.randomBytes(16).toString('hex').toUpperCase();
    
    try {
        const preference = {
            items: [{
                title: product.name,
                description: product.description,
                quantity: 1,
                currency_id: 'CLP',
                unit_price: product.price
            }],
            payer: { email, phone: { number: phone } },
            external_reference: paymentId,
            notification_url: `${BASE_URL}/api/webhook`,
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
}