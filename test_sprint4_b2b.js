
const { XmlrpcClient } = require('odoo-xmlrpc');

const odoo = new XmlrpcClient({
  url: process.env.ODOO_URL,
  db: process.env.ODOO_DB,
  username: process.env.ODOO_USERNAME,
  password: process.env.ODOO_PASSWORD,
});

async function xmlRpcCall(model, method, args, kwargs = {}) {
    return new Promise((resolve, reject) => {
        odoo.connect((err) => {
            if (err) return reject(err);
            odoo.execute_kw(model, method, args, kwargs, (err, value) => {
                if (err) return reject(err);
                resolve(value);
            });
        });
    });
}

async function verifyB2BOrder() {
    console.log("=== INICIANDO VERIFICACIÓN QA B2B ODOO ===");
    try {
        const partners = await xmlRpcCall('res.partner', 'search_read', [
            [['customer_rank', '>', 0], ['company_type', '=', 'company']]
        ], { fields: ['id', 'name', 'property_product_pricelist'], limit: 1 });

        if (partners.length === 0) throw new Error("No B2B Partner to test.");
        const partner = partners[0];
        console.log(`✅ Partner B2B localizado: ${partner.name} (ID: ${partner.id})`);

        const products = await xmlRpcCall('product.template', 'search_read', [
            [['sale_ok', '=', true], ['is_published', '=', true]]
        ], { fields: ['id', 'name', 'uom_id'], limit: 1 });
        
        const productTmpl = products[0];
        const variants = await xmlRpcCall('product.product', 'search_read', [
            [['product_tmpl_id', '=', productTmpl.id]]
        ], { fields: ['id'], limit: 1 });
        const productId = variants[0].id;
        console.log(`✅ Producto de prueba: ${productTmpl.name} (ID Variant: ${productId})`);

        console.log("Creando sale.order con x_studio_canal_origen = pwa_canal_tradicional...");
        
        const orderId = await xmlRpcCall('sale.order', 'create', [{
            partner_id: partner.id,
            partner_shipping_id: partner.id,
            partner_invoice_id: partner.id,
            date_order: new Date().toISOString().replace('T', ' ').substring(0, 19),
            commitment_date: new Date().toISOString().replace('T', ' ').substring(0, 19),
            pricelist_id: partner.property_product_pricelist ? partner.property_product_pricelist[0] : 1,
            note: "QA SPRINT 4 FINAL - VERIFICACION PWA B2B",
            x_studio_canal_origen: "pwa_canal_tradicional",
            order_line: [
                [0, 0, {
                    product_id: productId,
                    product_uom_qty: 2,
                }]
            ]
        }]);

        console.log(`\n🎉 ¡Pedido creado con éxito! ID: ${orderId}`);

        const orders = await xmlRpcCall('sale.order', 'search_read', [[['id', '=', orderId]]], {
            fields: ['name', 'state', 'x_studio_canal_origen', 'amount_total']
        });
        
        const createdOrder = orders[0];
        console.log(`\n--- RESULTADOS QA EN ODOO ---`);
        console.log(`- Referencia: ${createdOrder.name}`);
        console.log(`- Estado Inicial Odoo: ${createdOrder.state}`);
        console.log(`- Canal Origen: ${createdOrder.x_studio_canal_origen} ${createdOrder.x_studio_canal_origen === 'pwa_canal_tradicional' ? '✅' : '❌'}`);
        console.log(`- Monto Total: $${createdOrder.amount_total}`);
        
    } catch (e) {
        console.error("❌ Falla en la verificación QA:", e);
    }
}

verifyB2BOrder();
