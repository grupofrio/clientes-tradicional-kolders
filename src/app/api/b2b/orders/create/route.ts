import { NextResponse } from 'next/server';
import { callKw } from '@/lib/odoo';
import { verifyToken } from '@/lib/auth';
import { resolvePricesForPartner } from '@/lib/pricelist';
import { createPwaOrder, type PwaOrderResult } from '@/lib/odooPwaApi';
import { verifySameOrigin, rateLimit, clientIp, previewMutationBlocked, PREVIEW_BLOCKED_MESSAGE } from '@/lib/requestGuards';
import { cookies } from 'next/headers';
import { createHash } from 'crypto';

/**
 * Creación de pedidos B2B vía el ENDPOINT OFICIAL FIRMADO de Odoo
 * (/kold/pwa/order/create) — reemplaza el RPC directo `sale.order.create`.
 *
 * Por qué: el RPC directo dejaba órdenes sin trazabilidad PC#4 (origin=false,
 * x_operation_id=false, create_uid=DIRECCION, impuestos inconsistentes). El
 * endpoint oficial escribe el contrato completo (origin, x_operation_id,
 * x_kold_order_source=pwa_b2b, handoff/session/cart) y deja que Odoo compute
 * la fiscalidad, en estado draft (sin picking/factura/confirmación).
 *
 * Este route: valida sesión + guards, resuelve precios (price_unit requerido),
 * genera operation_id/idempotency_key estables, firma y llama al endpoint, y
 * mapea la respuesta (los duplicados se tratan como éxito idempotente).
 * El RPC de lectura se conserva SOLO para leer datos (ejecutivo, nombre de la
 * orden para la pantalla de éxito) — nunca para crear.
 */

export async function POST(request: Request) {
  try {
    const sessionCookie = (await cookies()).get('session')?.value;
    if (!sessionCookie) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const payload = await verifyToken(sessionCookie);
    if (!payload?.partner_id || !payload.b2b) return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 });

    // ── Guardrails de mutación (CSRF-equivalente, rate limit, preview guard) ──
    if (!verifySameOrigin(request)) {
      return NextResponse.json({ error: 'Solicitud no permitida.' }, { status: 403 });
    }
    if (!rateLimit(`orders-create:${payload.partner_id}:${clientIp(request)}`, 5, 60_000)) {
      return NextResponse.json({ error: 'Demasiados intentos. Espera un momento e intenta de nuevo.' }, { status: 429 });
    }
    if (previewMutationBlocked(payload.partner_id as number)) {
      console.warn('[B2B_ORDER] mutación bloqueada en preview', { partner_id: payload.partner_id });
      return NextResponse.json({ error: PREVIEW_BLOCKED_MESSAGE }, { status: 403 });
    }

    const body = await request.json();
    const { cart_lines, delivery_date, delivery_schedule, payment_method } = body;
    const clientSessionId: string | undefined = body?.session_id;
    const clientCartToken: string | undefined = body?.cart_token;
    // GAP conocido: el endpoint oficial /kold/pwa/order/create no acepta hoy la
    // nota general del pedido (`notes`) ni las notas por línea (`l.note`).
    // Pendiente Sebas: agregar soporte de `note` en el controller. Mientras,
    // las observaciones del cliente NO viajan (regresión menor a documentar).

    // ── Validación de input ────────────────────────────────────────────────
    if (!cart_lines || !Array.isArray(cart_lines) || cart_lines.length === 0) {
      return NextResponse.json({ error: 'El carrito está vacío' }, { status: 400 });
    }
    if (!delivery_date || !/^\d{4}-\d{2}-\d{2}$/.test(delivery_date)) {
      return NextResponse.json({ error: 'Fecha de entrega inválida' }, { status: 400 });
    }
    const deliveryDateObj = new Date(delivery_date + 'T12:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (deliveryDateObj <= today) {
      return NextResponse.json({ error: 'La fecha de entrega debe ser posterior a hoy' }, { status: 400 });
    }
    for (const line of cart_lines) {
      if (!line.product_id || typeof line.product_id !== 'number') {
        return NextResponse.json({ error: 'Producto inválido en el carrito' }, { status: 400 });
      }
      if (!line.qty || typeof line.qty !== 'number' || line.qty < 1) {
        return NextResponse.json({ error: `Cantidad inválida para ${line.name || 'producto'}` }, { status: 400 });
      }
    }

    const partnerId = Number(payload.partner_id);

    // ── Datos del partner (LECTURA) — ejecutivo + compañía para el UI/pedido ──
    const partnerRows = await callKw('res.partner', 'search_read', [[['id', '=', partnerId]]], {
      fields: ['name', 'user_id', 'company_id'],
      limit: 1,
    });
    if (!partnerRows.length) return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 });
    const partner = partnerRows[0];
    const companyId = partner.company_id ? partner.company_id[0] : parseInt(process.env.ODOO_COMPANY_ID || '34');

    // ── Precios: el endpoint REQUIERE price_unit por línea (pricelist del partner) ──
    const productIds = cart_lines.map((l: any) => l.product_id);
    let pricelistMap: Record<number, { price: number }> = {};
    try {
      pricelistMap = await resolvePricesForPartner(partnerId, productIds);
    } catch (priceErr) {
      console.warn('[B2B_ORDER] resolver de precios falló, usando fallback lst_price', priceErr);
    }
    // Fallback: leer lst_price si el resolver no cubrió algún producto.
    const missing = productIds.filter((id: number) => !pricelistMap[id]);
    if (missing.length) {
      const basics = await callKw('product.product', 'search_read', [[['id', 'in', missing]]], {
        fields: ['id', 'lst_price', 'list_price'],
      });
      for (const p of basics) pricelistMap[p.id] = { price: p.lst_price || p.list_price || 0 };
    }

    const order_lines = cart_lines.map((l: any) => ({
      product_id: l.product_id,
      quantity: l.qty,
      price_unit: Math.round((pricelistMap[l.product_id]?.price ?? 0) * 100) / 100,
    }));

    // ── Idempotencia: operation_id + idempotency_key estables por carrito ──
    const fingerprint = JSON.stringify({
      partner_id: partnerId,
      delivery_date,
      payment_method,
      lines: cart_lines
        .map((l: any) => ({ p: l.product_id, q: l.qty, n: (l.note || '').slice(0, 80) }))
        .sort((a: any, b: any) => a.p - b.p),
    });
    const sha = createHash('sha1').update(fingerprint).digest('hex');
    const operationId = `pwa-b2b-${sha.substring(0, 20)}`;
    const idempotencyKey = `b2b-${sha.substring(0, 24)}`;

    // ── Método de pago → vocabulario del endpoint ──
    const PAYMENT_MAP: Record<string, string> = {
      efectivo: 'Efectivo',
      tarjeta: 'tarjeta', // online token → sin método CFDI (cotización draft)
      credito: 'credito',
    };
    const paymentMethod = PAYMENT_MAP[payment_method] || 'Efectivo';

    // ── Llamada al endpoint OFICIAL firmado ──
    let result: PwaOrderResult;
    try {
      result = await createPwaOrder({
        operation_id: operationId,
        idempotency_key: idempotencyKey,
        partner_id: partnerId,
        company_id: companyId,
        order_lines,
        payment_method: paymentMethod,
        client_order_ref: `PWA-${operationId}`,
        delivery_date,
        commitment_date: delivery_date,
        delivery_schedule: typeof delivery_schedule === 'string' ? delivery_schedule : undefined,
        session_id: clientSessionId,
        cart_token: clientCartToken,
      });
    } catch (netErr: any) {
      console.error('[B2B_ORDER] endpoint oficial inaccesible', { partner_id: partnerId, err: netErr?.message });
      return NextResponse.json({ error: 'No se pudo enviar tu pedido. Intenta de nuevo.' }, { status: 502 });
    }

    // ── Mapeo de respuesta ──
    // Duplicados = éxito idempotente (mismo pedido). El resto de códigos = error.
    const isDuplicate = result.code === 'DUPLICATE_OPERATION' || result.code === 'DUPLICATE_IDEMPOTENCY_KEY';
    if (!result.ok && !isDuplicate) {
      const map: Record<string, number> = { UNAUTHORIZED: 502, VALIDATION_ERROR: 400, INTEGRITY_ERROR: 409, SERVER_ERROR: 502 };
      const status = map[result.code || ''] || 502;
      console.warn('[B2B_ORDER] endpoint rechazó la orden', { partner_id: partnerId, code: result.code, operation_id: operationId });
      return NextResponse.json({ error: 'No se pudo crear la orden. Intenta nuevamente.' }, { status });
    }

    const orderId = result.order_id;

    // ── Nombre de la orden para la pantalla de éxito (LECTURA) ──
    // Puente hasta que el endpoint devuelva `name`. Si falla, usamos el id.
    let orderName = orderId ? `Pedido ${orderId}` : 'Pendiente';
    if (orderId) {
      try {
        const rows = await callKw('sale.order', 'read', [[orderId]], { fields: ['name'] });
        if (rows?.[0]?.name) orderName = rows[0].name;
      } catch { /* fallback al id */ }
    }

    // ── Notificación al ejecutivo (n8n) — no fatal ──
    const webhookUrl = process.env.N8N_WEBHOOK_ORDERS || process.env.N8N_WEBHOOK_URL_B2B || process.env.N8N_WEBHOOK_URL;
    if (webhookUrl && !isDuplicate) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tipo: 'cotizacion_b2b',
            order_id: orderId,
            order_name: orderName,
            partner_name: partner.name,
            partner_id: partnerId,
            total: result.total,
            canal: 'pwa_b2b',
            operation_id: operationId,
            idempotency_key: idempotencyKey,
          }),
        });
      } catch (whErr) {
        console.error('[B2B_ORDER] webhook n8n error (non-fatal)', whErr);
      }
    }

    console.info('[B2B_ORDER] creada vía endpoint oficial', {
      order_id: orderId,
      partner_id: partnerId,
      operation_id: operationId,
      total: result.total,
      duplicate: isDuplicate,
    });

    // Contrato de respuesta compatible con cart/page.tsx (order_name, status, ejecutivo).
    return NextResponse.json({
      order_id: orderId,
      order_name: orderName,
      status: 'draft', // el endpoint no auto-confirma → "Pedido recibido"
      total_con_iva: result.total,
      operation_id: operationId,
      idempotent: isDuplicate,
      ejecutivo_nombre: partner.user_id ? partner.user_id[1] : 'Asesor Grupo Frío',
      ejecutivo_id: partner.user_id ? partner.user_id[0] : null,
    });
  } catch (error: any) {
    console.error('[B2B_ORDER] unhandled error', error?.message || error);
    return NextResponse.json({ error: 'Error al crear la orden. Intenta nuevamente.' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
