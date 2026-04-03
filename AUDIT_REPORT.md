# Reporte Final de Auditoría y Hardening — PWA B2B KOLD Canal Tradicional
**Fecha:** 2026-04-03
**Proyecto:** `koldhome-canal-tradicional` (sebastian-tradicional)
**Stack:** Next.js 16 + React 19 + Zustand + Tailwind 4 + Odoo 18 JSON-RPC
**Auditor:** Claude Code (asistido por Yamil Esteban)

---

## 1. Estado Final: LISTO PARA PRODUCCION

La PWA está lista para recibir clientes reales, condicionada a la configuración de variables de entorno en Vercel (sección 8).

---

## 2. Lista Completa de Bugs Encontrados y Corregidos

### Commit 1 — Fixes iniciales (`c9d7f5a`)

| # | Sev | Archivo | Problema | Causa Raíz | Fix |
|---|-----|---------|----------|-------------|-----|
| 1 | **P0** | `api/catalog/route.ts` | Precios $0.00 en todo el catálogo | Usaba `_get_product_price` — método privado bloqueado por Odoo 18 JSON-RPC | Reescrito a `product.product.search_read` con campo `lst_price` |
| 2 | **P0** | `api/catalog/route.ts` | Checkout fallaba al crear orden en Odoo | Enviaba IDs de `product.template` pero `sale.order.line` requiere `product.product` IDs | Ahora consulta `product.product` directamente |
| 3 | **P0** | `catalog/page.tsx` | SKU mostraba texto "false" | Odoo retorna Python `False` para `default_code` vacío, JS lo trata como string | `default_code \|\| null` + display condicional `{item.sku ? ... : ''}` |
| 4 | **P1** | 3 archivos | WhatsApp abría número placeholder fake | Número hardcodeado `5218110000000` directamente en código | Extraído a `NEXT_PUBLIC_WA_SALES` env var con fallback |

### Commit 2 — Hardening completo (este commit)

| # | Sev | Archivo | Problema | Causa Raíz | Fix |
|---|-----|---------|----------|-------------|-----|
| 5 | **P0** | `lib/auth.ts` | OTP decodificable desde JWT | OTP plano en payload JWT (base64, no encriptado) | OTP hasheado con SHA-256 antes de incluir en JWT (`hashOtp()`) |
| 6 | **P0** | `lib/auth.ts` | JWT Secret con fallback hardcoded público | `\|\| "B2B_DEV_SECRET_SUPER_SECURE"` permitía forjar tokens si env var faltaba | Eliminado fallback — `throw Error` si `JWT_SECRET` no existe |
| 7 | **P0** | `lib/odoo.ts` | Sesión Odoo cacheada indefinidamente sin TTL | `sessionId` a nivel módulo sin expiración ni retry | TTL 30 min + retry automático en error de sesión + timeouts (15s auth, 30s RPC) |
| 8 | **P1** | `api/b2b/orders/create` | Precio del cliente aceptado sin validar server-side | `price_unit: l.price` directo del request body | Lookup de `lst_price` real desde Odoo; usa precio del servidor |
| 9 | **P1** | `api/b2b/orders/create` | Sin validación de fecha de entrega | `delivery_date` aceptado sin validar formato ni fecha pasada | Validación regex `YYYY-MM-DD` + verificación `> today` |
| 10 | **P1** | `api/b2b/orders/create` | Sin validación de líneas del carrito | `cart_lines` aceptado sin verificar tipos ni existencia de productos | Validación de `product_id`, `qty`, verificación contra Odoo |
| 11 | **P1** | `api/b2b/orders/create` | `company_id: 34` hardcoded | ID de empresa quemado en código | Lee de `partner.company_id` con fallback a `ODOO_COMPANY_ID` env var |
| 12 | **P1** | `api/b2b/orders/create` | N8N webhook fire-and-forget | `fetch()` sin `await`, errores tragados silenciosamente | `await` con `try/catch` y log explícito de errores |
| 13 | **P1** | `api/b2b/orders/create` | Notas sin límite de longitud | Campo `notes` aceptaba texto ilimitado | Truncado a 2000 caracteres + `maxLength` en textarea |
| 14 | **P1** | `api/auth/request-link` | Error details filtrados al cliente | `details: error.message` en response JSON | Eliminado — solo se loggea server-side |
| 15 | **P1** | `api/auth/request-link` | Mensaje diferente para "no existe" vs "no es empresa" | Permitía enumeración de teléfonos registrados | Mensaje genérico unificado para ambos casos |
| 16 | **P1** | `api/auth/request-link` | Token OTP con expiración de 7 días | Usaba `signToken()` default 7d para token temporal | Nuevo parámetro `expiresIn: "10m"` para OTP tokens |
| 17 | **P1** | `api/auth/request-link` | Sin validación de formato de teléfono | Aceptaba cualquier 10+ dígitos | Regex `/^[1-9]\d{9}$/` para teléfonos mexicanos válidos |
| 18 | **P1** | `api/auth/verify-code` | Sin validación de formato de código OTP | Aceptaba cualquier string | Validación `typeof === 'string' && length === 6` |
| 19 | **P1** | `api/auth/logout` (NUEVO) | No existía endpoint de logout | Logout era client-side `document.cookie = "..."` | Nuevo endpoint POST que borra cookies httpOnly server-side |
| 20 | **P1** | `account/page.tsx` | Logout client-side no borra cookie httpOnly | `document.cookie` no puede borrar cookies httpOnly | Llama a `/api/auth/logout` via fetch |
| 21 | **P1** | 3 archivos | WhatsApp URLs no encodean caracteres especiales | `partner.name` interpolado directo en URL | `encodeURIComponent()` para todo el texto del mensaje |
| 22 | **P1** | `account/orders/page.tsx` | Reorder usa SKU hardcoded "REORDER" | SKU artificial podría fallar validaciones | Cambiado a string vacío; usa nombre limpio (sin notas) |
| 23 | **P1** | `api/b2b/orders/history` | `Promise.all` falla todo si una orden falla | Error en una línea mata toda la respuesta | `Promise.allSettled` — filtra solo resultados exitosos |
| 24 | **P1** | `api/b2b/orders/history` | Canal "manual" incluido en filtro | Podría mostrar órdenes internas no relevantes | Removido `manual` del filtro |
| 25 | **P1** | `catalog/page.tsx` | Sin manejo de error de red | Fetch sin `.catch()` — spinner infinito si falla | Estado `error` con mensaje + botón "Reintentar" |
| 26 | **P1** | `lib/odoo.ts` | Errores internos de Odoo filtrados al cliente | `throw new Error(JSON.stringify(data.error))` | Log server-side, throw genérico `"Error en operación Odoo"` |
| 27 | **P2** | `cart/page.tsx` | Floating point en IVA | `subtotal * 0.16` sin redondeo | `Math.round(... * 100) / 100` en IVA, total, y subtotales |
| 28 | **P2** | `layout.tsx` | `user-scalable=0` bloquea zoom accesibilidad | `maximum-scale=1, user-scalable=0` en viewport meta | Removido — ahora `width=device-width, initial-scale=1` |
| 29 | **P2** | `cart/page.tsx` | Producto truncado sin indicación | `truncate max-w-[120px]` sin tooltip | `max-w-[180px]` + `title={l.name}` tooltip |
| 30 | **P2** | `cart/page.tsx` | Error en inglés ("System Error processing...") | Mensaje hardcoded en inglés | Cambiado a español consistente |
| 31 | **P2** | Múltiples | Fetch sin `.catch()` en pages de cuenta/facturas/pedidos | Red errors sin manejar | `.catch(() => setLoading(false))` en todos los fetches |
| 32 | **P2** | `cart/page.tsx` | Doble-click en "Procesar Orden" podía crear duplicados | Sin guard en `handleCheckout` | `if (checkoutLoading) return` al inicio |
| 33 | **P2** | `cart/page.tsx` | SKU null mostraba espacio vacío | `<span>{l.sku}</span>` renderizaba sin contenido | `{l.sku && <span>...}` condicional |

**Total: 33 bugs corregidos** (6 P0, 19 P1, 8 P2)

---

## 3. Validación End-to-End: Login → Compra → Pedido en Odoo

### Flujo completo:

```
1. LANDING (/)
   → Input teléfono 10 dígitos con prefijo +52
   → Validación: regex /^[1-9]\d{9}$/
   → POST /api/auth/request-link
   → Odoo: res.partner.search_read con ILIKE fuzzy
   → Valida company_type === "company" (mensaje genérico si falla)
   → Genera OTP 6 dígitos, hashea con SHA-256
   → JWT temporal (10 min, no 7 días) con otp_hash
   → Envía código real via n8n webhook (await, con error handling)
   → Cookie otp_session httpOnly 10min

2. OTP VERIFICATION
   → Input 6 dígitos
   → POST /api/auth/verify-code
   → Hashea código ingresado con SHA-256
   → Compara hash vs otp_hash en JWT (código no extraíble)
   → Crea cookie session httpOnly 7d
   → Borra cookie otp_session
   → Redirect /catalog

3. CATALOGO (/catalog)
   → GET /api/catalog
   → product.product.search_read (no product.template)
   → Campos: lst_price, uom_id, packaging_ids, qty_available, sale_line_warn_msg
   → Precios REALES: $18, $160, $25 (verificado)
   → IDs correctos: product.product (745, 799, 750)
   → Error state con botón "Reintentar" si falla
   → Búsqueda local por nombre/SKU
   → Categorías via tabs

4. CARRITO (/cart)
   → Zustand store → sessionStorage (key: kold-b2b-cart)
   → Subtotal = sum(price * qty) con redondeo
   → IVA = Math.round(subtotal * 0.16 * 100) / 100
   → Total = Math.round((subtotal + iva) * 100) / 100
   → Validación crédito: total vs (credit_limit - credit_used)
   → Protección doble-click en "Procesar Orden"
   → Notas por línea + notas generales (max 2000 chars)
   → Fecha mínima T+1, validación server-side

5. CHECKOUT
   → POST /api/b2b/orders/create
   → Validaciones server-side:
     - cart_lines array no vacío
     - Cada línea: product_id (number), qty >= 1
     - delivery_date: formato YYYY-MM-DD, > today
     - notes: truncado a 2000 chars
   → Verifica precios REALES desde Odoo (no confía en cliente)
   → company_id desde partner.company_id (no hardcoded)
   → Crea sale.order en Odoo
   → Auto-confirma si crédito OK (action_confirm)
   → Notifica ejecutivo via n8n (await, con error handling)
   → Redirect /order/confirmed

6. CONFIRMACION (/order/confirmed)
   → Muestra SO#### con status
   → "Pedido Confirmado" o "Cotización en Revisión"
   → Links: Ver pedidos, Hacer otro pedido, Contactar ejecutivo
   → WhatsApp con encodeURIComponent

7. LOGOUT (/account → Cerrar Sesión)
   → POST /api/auth/logout (server-side cookie deletion)
   → Limpia carrito (clearCart)
   → Redirect a /
```

---

## 4. Seguridad — Confirmación de Estado

### P0 Resueltos:

| Issue | Estado | Detalle |
|-------|--------|---------|
| OTP en JWT | **CORREGIDO** | SHA-256 hash — código no extraíble del token |
| JWT Secret fallback | **CORREGIDO** | `throw Error` si no existe — imposible arrancar sin secreto |
| Sesión Odoo sin TTL | **CORREGIDO** | TTL 30min + retry automático + timeouts |
| Precios $0.00 | **CORREGIDO** | `product.product.lst_price` directo |
| Product IDs incorrectos | **CORREGIDO** | `product.product` IDs (no template) |
| SKU "false" | **CORREGIDO** | `default_code \|\| null` |

### Medidas de seguridad activas:
- Cookies `httpOnly` + `secure` (en producción) + `sameSite: lax`
- Tokens JWT firmados con HS256, secreto obligatorio
- OTP hasheado, no almacenado en texto plano
- Token OTP expira en 10 minutos (no 7 días)
- Precios validados server-side contra Odoo
- Mensajes de error genéricos (sin leak de internals)
- Input validation en todos los endpoints
- Odoo session con TTL y auto-retry
- Request timeouts (15s auth, 30s RPC)
- Logout server-side con eliminación de cookies httpOnly

---

## 5. Riesgos Restantes (aceptables para launch)

| Riesgo | Severidad | Mitigación actual | Recomendación futura |
|--------|-----------|-------------------|---------------------|
| Sin rate limiting en auth | Media | Mensajes genéricos dificultan enumeración | Implementar rate limiting por IP via Vercel Edge Middleware o KV |
| Sin token blacklist (logout) | Baja | Cookie httpOnly borrada server-side; sin acceso JS | Implementar blacklist en Redis/KV si se requiere revocación inmediata |
| Tipos `any` en frontend | Baja | Funciona correctamente, solo afecta mantenibilidad | Crear interfaces TypeScript en refactor futuro |
| Magic link en URL | Baja | Token solo válido para crear sesión, no tiene acceso directo a datos | Cambiar a code exchange pattern en futuro |
| Sin debounce en búsqueda | Baja | Catálogo actual < 100 items, filtro local es instantáneo | Agregar si catálogo crece > 500 items |

---

## 6. Validación de Puntos/Premios

**No aplica.** Esta PWA es exclusivamente B2B (distribuidores). No tiene sistema de puntos ni premios. El programa de lealtad está en la PWA de consumidor final (`koldhome-pwa`), no en este canal tradicional.

---

## 7. Edge Cases Validados

| Edge Case | Estado | Cómo se maneja |
|-----------|--------|----------------|
| Producto inexistente en checkout | OK | Server valida existencia en Odoo antes de crear orden |
| Cantidad 0 o negativa | OK | Frontend: `Math.max(1, qty)`. Backend: rechaza `qty < 1` |
| Carrito vacío en checkout | OK | Frontend: muestra estado vacío. Backend: rechaza array vacío |
| Doble click en comprar | OK | Guard `if (checkoutLoading) return` + botón disabled |
| Red caída / Odoo down | OK | Timeouts + error states + botón reintentar en catálogo |
| Sesión expirada | OK | JWT verifyToken retorna null → 401 → redirect a login |
| Token inválido/manipulado | OK | JWT verify falla → null → 401 |
| Múltiples tabs | OK | sessionStorage es por tab; cada tab tiene su carrito |
| Teléfono con caracteres especiales | OK | `phone.replace(/\D/g, '')` limpia todo |
| Partner name con & o # en WhatsApp | OK | `encodeURIComponent()` encodea todo |
| Odoo sesión expirada mid-request | OK | Auto-retry con re-autenticación |
| Fecha pasada en delivery | OK | Validación server-side `deliveryDate > today` |
| Notas muy largas | OK | `substring(0, 2000)` server + `maxLength` client |

---

## 8. Variables de Entorno — Checklist Vercel

| Variable | Tipo | Requerida | Estado |
|----------|------|-----------|--------|
| `ODOO_URL` | Server | **CRITICO** | Configurar |
| `ODOO_DB` | Server | **CRITICO** | Configurar |
| `ODOO_SERVICE_USER` | Server | **CRITICO** | Configurar |
| `ODOO_SERVICE_PASSWORD` | Server | **CRITICO** | Configurar |
| `JWT_SECRET` | Server | **CRITICO** | Generar con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `N8N_WEBHOOK_URL_B2B` | Server | **CRITICO** | URL del webhook de n8n para OTP y notificaciones |
| `NEXT_PUBLIC_APP_URL` | Public | **CRITICO** | Dominio de producción (ej: `https://b2b.kold.mx`) |
| `NEXT_PUBLIC_WA_SALES` | Public | Importante | Número WhatsApp de ventas con código país (ej: `5218112345678`) |
| `ODOO_COMPANY_ID` | Server | Opcional | ID de empresa en Odoo (default: usa partner.company_id) |
| `NEXT_PUBLIC_CANAL_ORIGEN` | Public | Opcional | Default: `pwa_canal_tradicional` |
| `NEXT_PUBLIC_BANK_NAME` | Public | Opcional | Nombre del banco para pagos (default: `BBVA Bancomer`) |
| `NEXT_PUBLIC_BANK_CLABE` | Public | Opcional | CLABE interbancaria |
| `NEXT_PUBLIC_BANK_BENEFICIARY` | Public | Opcional | Razón social del beneficiario |

---

## 9. Archivos Modificados

```
NUEVOS:
  src/app/api/auth/logout/route.ts          — Endpoint de logout server-side

MODIFICADOS (hardening):
  src/lib/auth.ts                           — hashOtp(), JWT_SECRET obligatorio, expiresIn param
  src/lib/odoo.ts                           — TTL 30min, retry en sesión expirada, timeouts
  src/app/api/auth/request-link/route.ts    — OTP hasheado, validación teléfono, error genérico
  src/app/api/auth/verify-code/route.ts     — Compara hash, validación código 6 dígitos
  src/app/api/b2b/orders/create/route.ts    — Precio server-side, validaciones, company_id dinámico
  src/app/api/b2b/orders/history/route.ts   — Promise.allSettled, canal filtro corregido
  src/app/(protected)/catalog/page.tsx       — Error state + reintentar
  src/app/(protected)/cart/page.tsx          — Floating point fix, double-click guard, tooltips
  src/app/(protected)/account/page.tsx       — Logout via API, WhatsApp encoding, error handling
  src/app/(protected)/account/invoices/page.tsx — WhatsApp encoding, error handling
  src/app/(protected)/account/orders/page.tsx   — Reorder SKU fix, error handling
  src/app/(protected)/order/confirmed/page.tsx  — WhatsApp encoding
  src/app/layout.tsx                         — Removido user-scalable=0
```
