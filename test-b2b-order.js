require('dotenv').config({ path: '.env.local' });
const { XmlrpcClient } = require('odoo-xmlrpc');

const odoo = new XmlrpcClient({
  url: process.env.ODOO_URL,
  db: process.env.ODOO_DB,
  username: process.env.ODOO_USERNAME,
  password: process.env.ODOO_PASSWORD,
});

async function findB2BPartner() {
    return new Promise((resolve, reject) => {
        odoo.connect((err) => {
            if (err) return reject(err);
            odoo.execute_kw('res.partner', 'search_read', [
                [['company_type', '=', 'company'], ['customer_rank', '>', 0], ['credit_limit', '>', 0], ['user_id', '!=', false]]
            ], { fields: ['id', 'name', 'credit_limit', 'credit'], limit: 1 }, (err, value) => {
                if (err) return reject(err);
                resolve(value[0]);
            });
        });
    });
}

// Emular la acción del backend B2B Create
async function simulateOrder(partnerId, paymentMethod) {
    return new Promise((resolve, reject) => {
         const orderFormat = {
            partner_id: partnerId,
            company_id: 34,
            pricelist_id: 81,
            payment_term_id: paymentMethod === 'credito' ? 1 : false, // Simula el default si lo tiene
            x_studio_canal_origen: "pwa_canal_tradicional",
            x_studio_horario_de_entrega_solicitado: 'Mañana (8:00 - 13:00)',
            note: 'Test de API B2B via E2E Script',
            order_line: [
                [0, 0, { product_id: 1, product_uom_qty: 3, price_unit: 100.0, name: 'Hielo Rolito KOLD Test' }]
            ]
         };

         odoo.execute_kw('sale.order', 'create', [orderFormat], (err, orderId) => {
             if (err) return reject(err);
             
             // Revisar su estado inicial
             odoo.execute_kw('sale.order', 'search_read', [[['id', '=', orderId]]], {fields: ['name', 'state', 'amount_total']}, (err, orderInfo) => {
                  resolve(orderInfo[0]);
             })
         });
    });
}

async function runTest() {
    try {
        console.log("1. Buscando Partner B2B...");
        const partner = await findB2BPartner();
        if(!partner) {
             console.log("No B2B partner found to test.");
             return;
        }
        console.log(`Encontrado: ${partner.name} (Credit Limit: ${partner.credit_limit}, Usado: ${partner.credit})`);
        
        console.log("2. Creando Orden B2B...");
        const order = await simulateOrder(partner.id, 'credito');
        console.log("Resultado de Creación:", order);

        // Simulando regla del controller Next.js ("Confirmed Automático porque le alcanza")
        if (partner.credit_limit > 0 && order.amount_total <= (partner.credit_limit - partner.credit)) {
             console.log("   -> [API LOGIC] El monto es menor a su crédito disponible. Aplicando Auto-Confirmación action_confirm...");
             
             await new Promise((resolve, reject) => {
                 odoo.execute_kw('sale.order', 'action_confirm', [[order.id]], (err) => {
                     if (err) return reject(err);
                     resolve();
                 });
             });

             const confirmedState = await new Promise((resolve, reject) => {
                odoo.execute_kw('sale.order', 'search_read', [[['id', '=', order.id]]], {fields: ['state']}, (err, val) => {
                    if (err) return reject(err);
                    resolve(val[0]);
                })
             });
             console.log("Resultado Final tras logic:", confirmedState);
        }

    } catch(e) {
        console.error(e);
    }
}

runTest();
