import { config } from 'dotenv';
config({ path: '.env.local' });

const ODOO_URL = process.env.ODOO_URL;
const ODOO_DB = process.env.ODOO_DB;
const ODOO_USER = process.env.ODOO_SERVICE_USER;
const ODOO_PASS = process.env.ODOO_SERVICE_PASSWORD;

async function run() {
  const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { db: ODOO_DB, login: ODOO_USER, password: ODOO_PASS }
    })
  });
  const data = await response.json();
  const setCookie = response.headers.get('set-cookie');
  const sessionMatch = setCookie?.match(/session_id=([^;]+)/);
  const sid = sessionMatch ? sessionMatch[1] : null;

  console.log("SID:", sid);

  const callRes = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_id=${sid}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model: 'res.partner',
        method: 'search_read',
        args: [[['mobile', 'ilike', '5555555555']]],
        kwargs: { fields: ['id', 'name', 'mobile', 'customer_rank', 'company_type', 'property_product_pricelist', 'property_payment_term_id', 'credit_limit', 'credit'], limit: 1 }
      }
    })
  });

  const callData = await callRes.json();
  console.log("CallData:", callData);
}
run().catch(console.error);
