# Reporte de Auditoría PWA B2B — KOLD Canal Tradicional
**Fecha:** 2026-04-03
**Proyecto:** `koldhome-canal-tradicional` (sebastian-tradicional)
**Stack:** Next.js 16 + React 19 + Zustand + Tailwind 4 + Odoo 18 JSON-RPC
**Auditor:** Claude Code (asistido por Yamil Esteban)

---

## 1. Resumen Ejecutivo

Se auditaron **19 archivos** entre API routes, páginas, componentes, stores y libs. Se identificaron y corrigieron **3 bugs P0** y **1 bug P1** antes de la revisión. El reporte documenta **todas** las observaciones adicionales para el equipo.

### Bugs Corregidos (ya aplicados)

| # | Severidad | Archivo | Problema | Fix |
|---|-----------|---------|----------|-----|
| 1 | **P0** | `api/catalog/route.ts` | Precios $0.00 — usaba `_get_product_price` (método privado bloqueado por Odoo 18) | Reescrito a `product.product.search_read` con `lst_price` |
| 2 | **P0** | `api/catalog/route.ts` | IDs de `product.template` enviados al carrito; `sale.order.line` necesita `product.product` | Ahora consulta `product.product` directamente |
| 3 | **P0** | `catalog/page.tsx` | SKU mostraba "false" (Python `False` en `default_code`) | `item.default_code \|\| null` + display condicional |
| 4 | **P1** | `account/page.tsx`, `invoices/page.tsx`, `order/confirmed/page.tsx` | WhatsApp usaba número placeholder hardcodeado | Extraído a `NEXT_PUBLIC_WA_SALES` env var |

### Resumen de Hallazgos Pendientes

| Severidad | Cantidad | Descripción |
|-----------|----------|-------------|
| P0 Crítico | 3 | Seguridad auth (OTP en JWT, JWT secret, sesión Odoo sin TTL) |
| P1 Importante | 10 | Validación de inputs, manejo de errores, precio sin verificar server-side |
| P2 Menor | 7 | UX polish, tipos `any`, accesibilidad |

---

## 2. Matriz de Pruebas

| Flujo | Estado | Notas |
|-------|--------|-------|
| **Login — Ingreso de teléfono** | OK | Envía OTP via n8n webhook, cookie httpOnly 10min |
| **Login — Verificación OTP** | OK | Compara contra JWT, crea sesión 7d |
| **Login — Magic Link** | OK | `/auth?token=...` verifica y crea sesión |
| **Protected Layout** | OK | Server-side cookie check, redirect a `/` si no hay sesión |
| **Catálogo — Carga productos** | OK (post-fix) | `product.product` con `lst_price`, precios reales |
| **Catálogo — Filtro por categoría** | OK | Tabs cambian `category` param, re-fetch |
| **Catálogo — Búsqueda** | OK | Filtro local por nombre/SKU |
| **Catálogo — Agregar al carrito** | OK | Input numérico, Zustand + sessionStorage |
| **Carrito — Ver items** | OK | Tabla con qty, subtotal, notas por línea |
| **Carrito — Cálculo IVA** | OK | `subtotal * 0.16`, total = subtotal + IVA |
| **Carrito — Validación crédito** | OK | Compara total vs `credit_limit - credit_used` |
| **Checkout — Crear orden** | OK | POST a Odoo `sale.order.create`, auto-confirma si crédito OK |
| **Checkout — Confirmación** | OK | Redirect a `/order/confirmed` con params |
| **Pedidos — Historial** | OK | Lista con accordion de líneas, badges de estado |
| **Pedidos — Reordenar** | OK* | Funciona pero usa SKU hardcoded "REORDER" (ver P1-8) |
| **Facturas — Lista** | OK | Facturas pendientes con status vencida/vigente |
| **Facturas — Modal pago** | OK | CLABE, banco, botón copiar, WhatsApp |
| **Cuenta — Perfil** | OK | Crédito, ejecutivo, nav menu |
| **Cuenta — Logout** | OK* | Borra cookie client-side (ver P1-3) |
| **Bottom Nav** | OK | Badge carrito, dot facturas vencidas |
| **Responsive mobile** | OK | `max-w-md mx-auto`, diseño mobile-first |
| **Build production** | OK | `npm run build` — 0 errores, 0 warnings |

---

## 3. Bugs Encontrados (Pendientes de Fix)

### P0 — Críticos (Requieren fix antes de producción o en primera iteración)

#### P0-1: OTP almacenado en JWT visible al cliente
- **Archivo:** `api/auth/request-link/route.ts:59`
- **Problema:** El OTP de 6 dígitos se guarda dentro del JWT (`signToken({...otp: otpCode})`). Los JWT NO están encriptados — el payload es base64 decodificable. Un atacante que intercepte la cookie `otp_session` puede extraer el OTP sin necesitar el WhatsApp.
- **Impacto:** Bypass de autenticación OTP.
- **Fix recomendado:** Almacenar OTP server-side (Redis, KV store, o tabla Odoo) con TTL de 10 minutos. Solo guardar `partner_id` en el JWT.
- **Mitigación temporal:** La cookie es `httpOnly` así que no es accesible via JS, pero sí via proxy/MITM sin HTTPS.

#### P0-2: JWT Secret con fallback hardcoded
- **Archivo:** `lib/auth.ts:3`
- **Código:** `const JWT_SECRET = process.env.JWT_SECRET || "B2B_DEV_SECRET_SUPER_SECURE"`
- **Problema:** Si `JWT_SECRET` no está configurado en Vercel, TODOS los tokens se firman con un secreto público conocido. Cualquiera puede forjar tokens.
- **Impacto:** Suplantación de identidad total.
- **Fix recomendado:** Eliminar fallback, lanzar error si no existe. Verificar que esté configurado en Vercel.

#### P0-3: Sesión Odoo sin TTL ni refresh
- **Archivo:** `lib/odoo.ts:15-18`
- **Código:** `let sessionId: string | null = null; if (sessionId) return sessionId;`
- **Problema:** El `sessionId` de Odoo se cachea indefinidamente a nivel de módulo. Si Odoo reinicia o la sesión expira server-side, TODAS las llamadas RPC fallan hasta que la instancia de Vercel se recicle.
- **Impacto:** PWA completamente inoperante hasta reciclaje de serverless function.
- **Fix recomendado:** Agregar TTL (30 min) o retry con re-autenticación al recibir error de sesión.

---

### P1 — Importantes (Fix recomendado en primera semana)

#### P1-1: Precio del cliente no se verifica server-side en checkout
- **Archivo:** `api/b2b/orders/create/route.ts:48`
- **Código:** `price_unit: l.price` — el precio viene directo del request body
- **Problema:** Un cliente técnico puede modificar el JSON y enviar precios arbitrarios (ej: $0.01 por caja).
- **Fix:** Lookup del `lst_price` real desde Odoo antes de crear la orden, o al menos validar que el precio enviado coincida con catálogo (tolerancia +-5%).

#### P1-2: Sin rate limiting en endpoints de auth
- **Archivo:** `api/auth/request-link/route.ts`, `api/auth/verify-code/route.ts`
- **Problema:** Sin límite de intentos. Brute force de OTP (1M combinaciones) o enumeración de teléfonos.
- **Fix:** Rate limit por IP (5 req/min en request-link, 3 intentos en verify-code).

#### P1-3: Logout borra cookie client-side solamente
- **Archivo:** `account/page.tsx:31`
- **Código:** `document.cookie = "session=; path=/; expires=..."`
- **Problema:** Token JWT sigue siendo válido por 7 días. No hay blacklist ni invalidación server-side.
- **Fix:** Crear `/api/auth/logout` que borre cookie server-side con `httpOnly`. Idealmente token blacklist.

#### P1-4: Catálogo sin manejo de error de red
- **Archivo:** `catalog/page.tsx:29-34`
- **Problema:** Si `/api/catalog` falla (Odoo caído, red), no hay `.catch()`. La UI queda en spinner infinito.
- **Fix:** Agregar `.catch()` que setee loading=false y muestre mensaje de error.

#### P1-5: Error details filtrados al cliente en request-link
- **Archivo:** `api/auth/request-link/route.ts:96`
- **Código:** `details: error.message || String(error)`
- **Problema:** Errores internos de Odoo (nombres de campos, SQL, stack traces) se envían al cliente.
- **Fix:** Solo loggear server-side, enviar mensaje genérico al cliente.

#### P1-6: `company_id: 34` hardcoded en creación de orden
- **Archivo:** `api/b2b/orders/create/route.ts:63`
- **Problema:** Si cambia el ID de la compañía en Odoo, todas las órdenes fallan.
- **Fix:** Leer de `partner.company_id` o variable de entorno.

#### P1-7: WhatsApp URLs no encodean nombre del partner
- **Archivos:** `account/page.tsx:38`, `order/confirmed/page.tsx:26`, `invoices/page.tsx:34`
- **Problema:** `partner.name` se interpola directo en URL. Si contiene `&`, `#`, o caracteres especiales, el mensaje se corta.
- **Fix:** Usar `encodeURIComponent()` para el texto completo del mensaje.

#### P1-8: Reorder usa SKU hardcoded "REORDER"
- **Archivo:** `account/orders/page.tsx:29`
- **Código:** `sku: "REORDER"`
- **Problema:** Si el carrito o checkout validan SKU, esto podría fallar silenciosamente.
- **Fix:** Usar SKU original de la línea de orden, o `null`.

#### P1-9: N8N webhook fire-and-forget en creación de orden
- **Archivo:** `api/b2b/orders/create/route.ts:92`
- **Problema:** El webhook de notificación al ejecutivo no se `await`-ea. Si falla, nadie se entera del pedido nuevo.
- **Fix:** Al menos loggear errores de forma visible, o usar `await` con timeout.

#### P1-10: Orders history incluye canal "manual"
- **Archivo:** `api/b2b/orders/history/route.ts:16`
- **Código:** `['x_studio_canal_origen', 'in', ['pwa_canal_tradicional', 'manual', 'botpress']]`
- **Problema:** Incluir `manual` podría mostrar órdenes internas que no corresponden al cliente PWA.
- **Fix:** Evaluar si `manual` debe incluirse. Si sí, documentar por qué.

---

### P2 — Menores (Backlog)

#### P2-1: Floating point en cálculo de IVA
- `cart/page.tsx:62` — `subtotal * 0.16` puede dar centavos imprecisos (ej: $0.004999... vs $0.005).
- Fix: `Math.round(subtotal * 0.16 * 100) / 100`

#### P2-2: `user-scalable=0` bloquea zoom accesibilidad
- `layout.tsx:23` — `maximum-scale=1, user-scalable=0` impide zoom en móvil para usuarios con discapacidad visual.
- Fix: Quitar `maximum-scale` y `user-scalable`.

#### P2-3: Tipos `any` en todo el frontend
- Múltiples archivos usan `useState<any>` sin interfaces.
- Fix: Crear interfaces `Partner`, `Invoice`, `Order`, etc.

#### P2-4: Producto truncado sin tooltip en carrito
- `cart/page.tsx:135` — `truncate max-w-[120px]` corta nombres sin indicación.
- Fix: Agregar `title={l.name}`.

#### P2-5: Sin debounce en búsqueda de catálogo
- `catalog/page.tsx:94` — Filtra en cada keystroke. Con catálogos grandes puede lagear.
- Fix: Debounce 300ms.

#### P2-6: Fecha sin validación en checkout
- `cart/page.tsx:182` — Solo tiene `min` HTML. No valida server-side formato ni fecha pasada.
- Fix: Validar `delivery_date` en API.

#### P2-7: Error inconsistente en inglés/español
- `cart/page.tsx:99` — "System Error processing wholesale order" (inglés) en app en español.
- Fix: Unificar mensajes a español.

---

## 4. Validación de Compra End-to-End

### Flujo completo verificado:

```
1. Login (/):
   - Input teléfono 10 dígitos → POST /api/auth/request-link
   - Odoo busca res.partner con ILIKE fuzzy
   - Valida company_type === "company"
   - Genera OTP 6 dígitos, envía a n8n, guarda en cookie httpOnly

2. OTP Verification:
   - Input 6 dígitos → POST /api/auth/verify-code
   - Compara contra OTP en JWT (ver P0-1)
   - Crea cookie session 7d httpOnly

3. Catálogo (/catalog):
   - GET /api/catalog → product.product.search_read
   - Campos: lst_price, uom_id, packaging_ids, qty_available
   - Precios reales verificados: $18, $160, $25 (post-fix)
   - IDs son product.product (post-fix)

4. Carrito (/cart):
   - Zustand store persistido en sessionStorage
   - Subtotal = sum(price * qty)
   - IVA = subtotal * 16%
   - Total = subtotal + IVA
   - Validación de crédito: total vs (credit_limit - credit_used)

5. Checkout:
   - POST /api/b2b/orders/create con cart_lines, delivery_date, horario, payment_method
   - Crea sale.order en Odoo con order_line [(0,0,{...})]
   - Auto-confirma si crédito OK (action_confirm)
   - Redirect a /order/confirmed con status

6. Confirmación:
   - Muestra nombre del pedido (SO####)
   - Status: "Pedido Confirmado" o "Cotización en Revisión"
   - Links a pedidos, catálogo, WhatsApp ejecutivo
```

### Datos verificados via API:
```json
[
  {"id": 745, "name": "FROZEN PROCESSED RASPBERRY SNACK", "price": 18, "uom": "Pza"},
  {"id": 799, "name": "Frozen processed blackberry snack", "price": 160, "uom": "Pza"},
  {"id": 750, "name": "KOLD BOLSA DE HIELO CILINDRO (5KG)", "price": 25, "uom": "Pza"}
]
```

---

## 5. Validación de Puntos/Premios

**No aplica.** Esta PWA es exclusivamente B2B (distribuidores). No tiene sistema de puntos ni premios. El programa de lealtad está en la PWA de consumidor final (`koldhome-pwa`), no en este canal tradicional.

---

## 6. Validación Responsive

| Viewport | Resultado | Notas |
|----------|-----------|-------|
| **Mobile 375x812** (iPhone) | OK | Diseño mobile-first. `max-w-md mx-auto` centra todo. Bottom nav fijo. |
| **Mobile 390x844** (iPhone 14) | OK | Sin overflow horizontal. Tablas scroll correctamente. |
| **Tablet 768x1024** | OK | Layout centrado max-w-md (448px). Espacio lateral vacío intencional. |
| **Desktop 1440x900** | OK | Mismo comportamiento que tablet. Shadow lateral da efecto "phone frame". |

**Diseño:** La app usa `max-w-md mx-auto shadow-2xl` en root layout — simula un teléfono en pantallas grandes. No hay breakpoints responsive porque es intencionalmente mobile-only.

**Issues responsive menores:**
- `pb-32` hardcoded en todas las páginas para clearance del bottom nav (funciona pero no es dinámico).
- Nombres de producto truncados a `max-w-[120px]` en carrito — muy agresivo en pantallas mayores.
- Tabs de categorías usan `overflow-x-auto` — funciona bien en mobile.

---

## 7. Código — Cambios Aplicados

### `src/app/api/catalog/route.ts` — REESCRITURA MAYOR

**Antes:** Usaba `product.template` + `_get_product_price` (privado en Odoo 18) = AccessError.

**Después:**
- Query a `product.product` directamente
- Lee `lst_price` (ya incluye pricelist del contexto)
- Resuelve packaging en batch
- Retorna IDs de `product.product` (correctos para `sale.order.line`)
- SKU: `item.default_code || null` (no más `false`)

### `src/app/(protected)/catalog/page.tsx` — FIX SKU + PLACEHOLDER

- SKU display: `{item.sku ? \`SKU: ${item.sku} · \` : ''}{item.warning || item.uom}`
- Qty input: `getCartQty` retorna `""` en vez de `0` cuando no está en carrito

### `src/app/(protected)/account/page.tsx` — ENV VAR WHATSAPP

- `window.open(\`https://wa.me/${process.env.NEXT_PUBLIC_WA_SALES || '5218110000000'}...\`)`

### `src/app/(protected)/order/confirmed/page.tsx` — ENV VAR WHATSAPP (x2)

- Misma extracción en try y catch del `handleContactExecutive`

### `src/app/(protected)/account/invoices/page.tsx` — ENV VAR WHATSAPP

- `handleWhatsappTransfer` usa env var

---

## 8. Variables de Entorno Requeridas en Vercel

| Variable | Tipo | Requerida | Ejemplo |
|----------|------|-----------|---------|
| `ODOO_URL` | Server | Si | `https://odoo.empresa.com` |
| `ODOO_DB` | Server | Si | `produccion` |
| `ODOO_SERVICE_USER` | Server | Si | `api@empresa.com` |
| `ODOO_SERVICE_PASSWORD` | Server | Si | `***` |
| `JWT_SECRET` | Server | **CRITICO** | `crypto.randomBytes(32).toString('hex')` |
| `N8N_WEBHOOK_URL_B2B` | Server | Si | `https://n8n.empresa.com/webhook/xxx` |
| `NEXT_PUBLIC_APP_URL` | Public | Si | `https://b2b.kold.mx` |
| `NEXT_PUBLIC_WA_SALES` | Public | Si | `5218112345678` |
| `NEXT_PUBLIC_CANAL_ORIGEN` | Public | No | `pwa_canal_tradicional` (default) |
| `NEXT_PUBLIC_BANK_NAME` | Public | No | `BBVA Bancomer` |
| `NEXT_PUBLIC_BANK_CLABE` | Public | No | `012345678901234567` |
| `NEXT_PUBLIC_BANK_BENEFICIARY` | Public | No | `GLACIEM SA DE CV` |

---

## 9. Checklist Pre-Deploy

- [x] Build sin errores
- [x] Precios reales desde Odoo (lst_price)
- [x] IDs product.product para sale.order.line
- [x] SKU null handling
- [x] WhatsApp env var extraída
- [ ] **Configurar `JWT_SECRET` fuerte en Vercel** (P0-2)
- [ ] **Configurar `NEXT_PUBLIC_WA_SALES` en Vercel**
- [ ] **Configurar todas las env vars de Odoo en Vercel**
- [ ] **Verificar que el dominio de Vercel coincide con `NEXT_PUBLIC_APP_URL`**
- [ ] Considerar fix P0-1 (OTP en JWT) en primera semana
- [ ] Considerar fix P0-3 (Odoo session TTL) en primera semana
- [ ] Configurar env vars bancarias (CLABE, banco, beneficiario)
