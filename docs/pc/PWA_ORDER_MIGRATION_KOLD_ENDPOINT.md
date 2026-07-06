# Migración de creación de pedidos B2B PWA → endpoint oficial `/kold/pwa/order/create`

**Fecha:** 2026-07-06 · **Estado: propuesta + PR draft (sin deploy, sin merge, sin pedidos productivos).**
**Fuentes:** código real de la PWA (`grupofrio/clientes-tradicional-kolders`) + código real del controller Odoo (`GrupoVeniu/GrupoFrio` → `invoice_controller/controllers/pwa_api.py`, clon local `~/dev/GrupoFrio` @ `79d9f41`, ambos leídos, cero writes). **No se imprimió ningún secreto.**

---

## 1. Dictamen ejecutivo

**Confirmado el hallazgo de Odoo.** La PWA **NO usa el endpoint oficial** `/kold/pwa/order/create`. Crea la cotización por **JSON-RPC directo** (`sale.order.create` vía `/web/dataset/call_kw`) autenticado con el **usuario de servicio** (`ODOO_SERVICE_USER`/`ODOO_SERVICE_PASSWORD` = la cuenta DIRECCION GRUPO FRIO). Por eso las órdenes S20690/S21767 aparecen con `origin=false`, `x_operation_id=false`, `create_uid=DIRECCION`, sin `x_kold_handoff_source/session_id/cart_token`, y con impuestos inconsistentes: el RPC arma las líneas con `tax_id` manual (o lo omite si hay mismatch de compañía), en vez de dejar que Odoo compute la fiscalidad como sí hace el endpoint oficial.

**Buena noticia:** el endpoint oficial existe, está completo, y sus dos claves (`ODOO_PWA_API_KEY`, `ODOO_PWA_API_SECRET`) ya están en el env de la PWA. La migración es **factible y acotada**: la mayor parte de la lógica pesada del route actual (dedup, fiscalidad, warehouse) la asume Odoo; el route de la PWA se vuelve más delgado (validar carrito + resolver precios + firmar + POST + mapear respuesta).

**Recomendación:** migrar a `/kold/pwa/order/create` (firmado, `auth=api_key`), **NO** al público `/kold/pwa/web/order/create`. El RPC directo se conserva **solo para lecturas** (catálogo, perfil, facturas, historial), nunca más para crear pedidos.

## 2. Cómo crea pedidos la PWA hoy (flujo exacto)

```
cart/page.tsx (handleCheckout)
  → POST /api/cart/validate                 (valida precios/stock vs Odoo, RPC)
  → POST /api/b2b/orders/create             ← AQUÍ se crea
        src/app/api/b2b/orders/create/route.ts
          · callKw('sale.order','create', [...])   via src/lib/odoo.ts
          · lib/odoo.ts: authenticate() → /web/session/authenticate
                         con ODOO_SERVICE_USER/ODOO_SERVICE_PASSWORD
                         → /web/dataset/call_kw   (JSON-RPC directo)
          · setea x_kold_order_source='pwa_b2b', x_kold_idempotency_key='b2b-<sha1>',
            x_studio_canal_origen, tax_id manual por línea, warehouse por plaza
          · (opcional) action_confirm si pago a crédito dentro de límite
          · POST N8N_WEBHOOK_ORDERS  (notificación al ejecutivo, NO creación)
  → router.push('/order/confirmed?orderName=Sxxxx')   "¡Pedido recibido!"
```

- **Archivo/función:** `src/app/api/b2b/orders/create/route.ts` → `POST()`; motor RPC en `src/lib/odoo.ts` (`authenticate`, `callKw`).
- **¿RPC directo?** **Sí, confirmado** — `call_kw` con usuario/contraseña de servicio.
- **¿Endpoint oficial?** No — `grep` de `/kold/pwa/order/create`, `ODOO_PWA_API_KEY`, `x_operation_id`, `handoff_source` en la PWA = **cero coincidencias**.
- **`N8N_WEBHOOK_ORDERS`:** solo **notificación post-create** al ejecutivo comercial (tipo cotización_b2b). No participa en la creación. Se conserva.

## 3. Contrato del endpoint oficial (leído del controller real)

**Ruta:** `POST {ODOO_URL}/kold/pwa/order/create` · `type="json"` (envoltura JSON-RPC 2.0) · `auth="api_key"` + firma HMAC obligatoria.

### 3.1 Autenticación (2 capas, ambas requeridas)
1. **API key** — header **`API-KEY: <ODOO_PWA_API_KEY>`** (Odoo `auth_api_key` lee `HTTP_API_KEY`). Resuelve el usuario técnico de la key; el create corre en contexto elevado → `create_uid` NO es DIRECCION.
2. **Firma HMAC** (`_verify_signature`, activa por `invoice_controller.pwa_enforce_signature=1`):
   - header **`X-KOLD-Timestamp: <unix_seconds>`**
   - header **`X-KOLD-Signature: v1=<base64(HMAC_SHA256(secret, "{ts}." + rawBody))>`**
   - `secret` = `invoice_controller.pwa_api_secret` (= `ODOO_PWA_API_SECRET` en la PWA)
   - ventana TTL = `pwa_signature_ttl_seconds` (default **300 s**) → rechaza si `|now-ts| > ttl`
   - el mensaje firmado es **`f"{ts}."` + los bytes crudos del body** (el envelope JSON-RPC completo)
   - comparación con `hmac.compare_digest` (timing-safe)
   - Sin firma válida → `{"ok":false,"code":"UNAUTHORIZED"}`.
   - El path público `/kold/pwa/web/...` salta la firma **solo si** `pwa_web_public_enabled=1` — **ese es el riesgo del §6; nosotros NO lo usamos.**

### 3.2 Payload (envelope JSON-RPC → `params` → `meta`/`data`)
```jsonc
{ "jsonrpc":"2.0", "method":"call", "params": {
  "meta": { "operation_id":"<req>", "idempotency_key":"<opt>" },
  "data": {
    "channel": "b2b",                 // "b2b"|"canal" → source "pwa_b2b"
    "company_id": 34,                 // default 34
    "partner_id": <int>,              // del JWT de sesión (o partner_token)
    "order_lines": [                  // price_unit REQUERIDO por línea
      { "product_id": <int>, "quantity": <float>, "price_unit": <float> }
    ],
    "handoff_source": "pwa_b2b_app",  // → x_kold_handoff_source
    "session_id": "<opt>",            // → x_kold_session_id
    "cart_token": "<opt>",            // → x_kold_cart_token
    "payment_method": "Efectivo",     // efectivo/tarjeta; online tokens OK
    "client_order_ref": "<opt>",      // default PWA-{operation_id}
    "x_delivery_date": "YYYY-MM-DD",
    "commitment_date": "YYYY-MM-DD",  // presale canal: default T+1 10:00
    "x_studio_horario_de_entrega_solicitado": "<opt>"
  }
}}
```
`operation_id` puede ir en `meta` o `data`; igual `idempotency_key`. **`price_unit` es obligatorio** (el endpoint rechaza líneas sin precio); la PWA ya resuelve precios por pricelist (`lib/pricelist`) → los envía. Odoo **computa los impuestos** (las líneas se crean con `product_id/qty/price_unit`, la fiscalidad la aplica el modelo) → resuelve el "impuestos ausentes".

### 3.3 Qué escribe el endpoint (contrato PC#4)
`origin = "PWA/pwa_b2b/{operation_id[:40]}"` · `client_order_ref` · `x_kold_order_source="pwa_b2b"` · `x_operation_id` · `x_kold_idempotency_key` (si se envía) · `x_kold_handoff_source/session_id/cart_token` (si vienen) · `x_source` (si el módulo de rutas está) · pricelist_id · commitment_date. **Sin `action_confirm`** → queda draft, **sin picking, sin factura, sin confirmación**. Impuestos por Odoo.

### 3.4 Respuesta
Éxito: `{ "ok":true, "duplicate":false, "order_id":<int>, "state":"draft", "total":<con IVA>, "source":"pwa_b2b", "commitment_date":..., "is_presale":true, "operation_id":..., "idempotency_key":..., "portal_url":... }`.
**⚠️ No devuelve `order.name` ("Sxxxxx").** Ver §7-riesgo: pedir a Sebas agregar `"name": order.name` a la respuesta (1 línea) o mostrar `operation_id`/`order_id` mientras.
Errores (todos `ok:false` + `code`): `UNAUTHORIZED` (firma/api key), `VALIDATION_ERROR`, `DUPLICATE_OPERATION` (mismo `operation_id` → devuelve el order_id existente), `DUPLICATE_IDEMPOTENCY_KEY`, `INTEGRITY_ERROR`, `SERVER_ERROR`.

## 4. Firma / seguridad (resumen accionable)
- Headers a mandar: `API-KEY`, `X-KOLD-Timestamp`, `X-KOLD-Signature: v1=...`, `Content-Type: application/json`.
- Firmar **exactamente los bytes** que se envían (serializar el body una vez, firmar ese buffer, mandar ese buffer).
- Secretos: leídos de `process.env` server-side, **nunca** al cliente, **nunca** a logs. El PR loguea solo `code`/`operation_id`, jamás la key/secret/firma.
- Manejo de error de firma: `UNAUTHORIZED` → 502 al cliente con mensaje genérico ("No se pudo enviar tu pedido, intenta de nuevo"), y log server con el `code` (sin secretos).

## 5. Idempotencia
- **`operation_id`**: nuevo, estable por intento de pedido. Propuesta: `pwa-b2b-{partner_id}-{sha1(cart+fecha+pago)[:16]}` o un UUID por sesión de checkout persistido en el store hasta éxito. El endpoint deduplica por `x_operation_id` (búsqueda previa + `IntegrityError` con rollback) → doble click/recarga/reintento devuelven `DUPLICATE_OPERATION` con el `order_id` original.
- **`idempotency_key`**: se conserva la derivación actual (`b2b-<sha1>`), mapea a `x_kold_idempotency_key`. Segunda barrera (`DUPLICATE_IDEMPOTENCY_KEY`).
- **UX en duplicado:** la PWA trata `DUPLICATE_OPERATION`/`DUPLICATE_IDEMPOTENCY_KEY` como **éxito idempotente** (muestra "Pedido recibido" con el pedido existente), nunca como error — igual que hoy hace el route con su replay.

## 6. No usar el endpoint público
`/kold/pwa/web/order/create` (`auth="public"`) salta la firma cuando `invoice_controller.pwa_web_public_enabled=1`. **La PWA NO lo usa** — usa el firmado `/kold/pwa/order/create`. (El flag público es tema de hardening de Odoo, aparte.)

## 7. Riesgos
| Riesgo | Mitigación |
|--------|-----------|
| **La respuesta no trae `order.name`** ("Sxxxxx") que la pantalla de éxito muestra | Pedir a Sebas agregar `"name": order.name` a la respuesta (1 línea). Mientras: mostrar "Pedido recibido" + `operation_id`, o hacer una lectura del name por `order_id` |
| Código **no testeado end-to-end** (crear pedido real requiere API key en Vercel + S/N) | El PR es **draft, no-merge**; el HMAC sí se valida con test local; QA con partner de prueba antes de merge |
| Reloj desfasado > 300 s → firma expirada | Usar `Date.now()` del server (Vercel sincronizado); TTL 300 s holgado |
| Migración cambia el momento de impuestos/precios | El endpoint confía en `price_unit` enviado (igual que hoy) y computa impuestos — validar totales en el pedido de prueba |
| `payment_method` a crédito | El endpoint no auto-confirma; el crédito B2B se maneja como cotización draft (como hoy) — verificar mapeo de método |
| Perder lógica útil del route actual (warehouse por plaza) | El endpoint resuelve warehouse/plaza server-side; validar en el pedido de prueba que asigna la plaza correcta |
| **El endpoint no acepta `notes` (observaciones) ni notas por línea** | Regresión menor: las observaciones del cliente no viajan. Pedir a Sebas soportar `note` en el controller; mientras, documentado en el código |

## 8. Tests a correr
1. **HMAC (local, sin Odoo):** el firmante TS produce el mismo `v1=base64(hmac_sha256(secret,"{ts}."+body))` que el `_verify_signature` de Python para un `(ts, body, secret)` conocido. **Incluido en el PR.**
2. **Build/lint** de la PWA.
3. **Integración (con S/N, partner de prueba 54907):** crear 1 pedido → validar en Odoo el contrato del §3.3 (origin, x_operation_id, x_kold_order_source=pwa_b2b, handoff/session/cart, impuestos, draft sin picking/factura, create_uid ≠ DIRECCION).
4. **Idempotencia:** reenviar el mismo `operation_id` → `DUPLICATE_OPERATION`, sin segundo pedido.

## 9. Variables de entorno necesarias
- `ODOO_URL` (ya) · `ODOO_PWA_API_KEY` (ya) · `ODOO_PWA_API_SECRET` (ya). Confirmar en Vercel que **existen en el entorno de producción y preview** (no imprimir valores).
- Se conservan `ODOO_SERVICE_USER/PASSWORD` para lecturas RPC (catálogo/perfil/facturas). `N8N_WEBHOOK_ORDERS` se mantiene (notificación).

## 10. Validación en Odoo tras el cambio (candidato GREEN PC#4)
Sobre el pedido de prueba: `x_kold_order_source=pwa_b2b` · `x_operation_id` presente · `x_kold_idempotency_key` presente · `origin="PWA/pwa_b2b/{op}"` · `client_order_ref` útil · `x_kold_handoff_source="pwa_b2b_app"` · `x_kold_session_id`/`x_kold_cart_token` si se enviaron · impuestos aplicados · `state=draft` sin picking/factura · `create_uid ≠ DIRECCION GRUPO FRIO` · sin `origin=false` ni `x_operation_id=false`.
