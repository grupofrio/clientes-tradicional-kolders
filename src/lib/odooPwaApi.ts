import { createHmac } from "crypto";

/**
 * Cliente del endpoint OFICIAL firmado de Odoo para crear pedidos B2B PWA:
 *   POST {ODOO_URL}/kold/pwa/order/create   (type=json, auth=api_key + HMAC)
 *
 * Contrato leído del controller real (invoice_controller/controllers/pwa_api.py):
 *  - Header API-KEY: <ODOO_PWA_API_KEY>  (auth_api_key → HTTP_API_KEY)
 *  - Firma HMAC (invoice_controller._verify_signature):
 *      X-KOLD-Timestamp: <unix_seconds>
 *      X-KOLD-Signature: v1=<base64(HMAC_SHA256(secret, `${ts}.` + rawBody))>
 *      secret = ODOO_PWA_API_SECRET ; TTL server = 300s
 *  - Body = envelope JSON-RPC 2.0: { jsonrpc, method:"call", params:{ meta, data } }
 *  - NUNCA se usa el endpoint público /kold/pwa/web/order/create.
 *
 * Los secretos se leen server-side y NO se loguean jamás.
 */

const ODOO_URL = process.env.ODOO_URL;
const PWA_API_KEY = process.env.ODOO_PWA_API_KEY;
const PWA_API_SECRET = process.env.ODOO_PWA_API_SECRET;

export interface PwaOrderLine {
  product_id: number;
  quantity: number;
  price_unit: number;
}

export interface PwaOrderParams {
  operation_id: string;
  idempotency_key?: string;
  partner_id: number;
  company_id?: number;
  order_lines: PwaOrderLine[];
  payment_method?: string;
  client_order_ref?: string;
  delivery_date?: string; // YYYY-MM-DD
  commitment_date?: string; // YYYY-MM-DD o datetime
  delivery_schedule?: string; // horario solicitado
  note?: string; // observaciones (nivel orden) → sale.order.note
  session_id?: string;
  cart_token?: string;
}

export interface PwaOrderResult {
  ok: boolean;
  code?: string;
  error?: string;
  duplicate?: boolean;
  order_id?: number;
  name?: string; // nombre de la orden ("Sxxxxx") — desde PR#188 (éxito y duplicados)
  state?: string;
  total?: number;
  source?: string;
  operation_id?: string;
  idempotency_key?: string | false;
  portal_url?: string;
  is_presale?: boolean;
}

/**
 * Firma HMAC-SHA256 idéntica a invoice_controller._verify_signature:
 * base64( HMAC_SHA256( secret, `${ts}.` + rawBody ) ), prefijada `v1=`.
 * `rawBody` DEBE ser exactamente los bytes que se envían en el POST.
 */
export function signKoldRequest(secret: string, tsSeconds: number, rawBody: string): string {
  const message = Buffer.concat([
    Buffer.from(`${tsSeconds}.`, "utf-8"),
    Buffer.from(rawBody, "utf-8"),
  ]);
  const digest = createHmac("sha256", secret).update(message).digest("base64");
  return `v1=${digest}`;
}

/**
 * Crea el pedido B2B vía el endpoint oficial firmado. Devuelve el resultado
 * tal cual (incluye los códigos de duplicado, que el caller trata como éxito
 * idempotente). Lanza solo en fallos de red/config; jamás expone secretos.
 */
export async function createPwaOrder(
  params: PwaOrderParams,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<PwaOrderResult> {
  if (!ODOO_URL || !PWA_API_KEY || !PWA_API_SECRET) {
    throw new Error("Faltan variables de entorno para el endpoint oficial (ODOO_URL / ODOO_PWA_API_KEY / ODOO_PWA_API_SECRET).");
  }

  const data: Record<string, unknown> = {
    channel: "b2b", // → source "pwa_b2b"
    company_id: params.company_id ?? 34,
    partner_id: params.partner_id,
    order_lines: params.order_lines.map((l) => ({
      product_id: l.product_id,
      quantity: l.quantity,
      price_unit: l.price_unit,
    })),
    handoff_source: "pwa_b2b_app",
  };
  if (params.session_id) data.session_id = params.session_id;
  if (params.cart_token) data.cart_token = params.cart_token;
  if (params.payment_method) data.payment_method = params.payment_method;
  if (params.client_order_ref) data.client_order_ref = params.client_order_ref;
  if (params.delivery_date) data.x_delivery_date = params.delivery_date;
  if (params.commitment_date) data.commitment_date = params.commitment_date;
  if (params.delivery_schedule) data.x_studio_horario_de_entrega_solicitado = params.delivery_schedule;
  if (params.note) data.note = params.note; // el endpoint acepta note|notes|observaciones (PR#188)

  const meta: Record<string, unknown> = { operation_id: params.operation_id };
  if (params.idempotency_key) meta.idempotency_key = params.idempotency_key;

  // Serializar UNA sola vez: se firma y se envía exactamente este buffer.
  const rawBody = JSON.stringify({ jsonrpc: "2.0", method: "call", params: { meta, data } });
  const signature = signKoldRequest(PWA_API_SECRET, nowSeconds, rawBody);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(`${ODOO_URL.replace(/\/+$/, "")}/kold/pwa/order/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "API-KEY": PWA_API_KEY,
        "X-KOLD-Timestamp": String(nowSeconds),
        "X-KOLD-Signature": signature,
      },
      body: rawBody,
      signal: controller.signal,
    });
    const json = await res.json();
    // type=json envuelve el retorno del controller en `result`.
    const result = (json?.result ?? json) as PwaOrderResult;
    return result;
  } finally {
    clearTimeout(timeout);
  }
}
