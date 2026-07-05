# Entregable 1 — Auditoría técnica y funcional del repo (v2)

Repo: `grupofrio/clientes-tradicional-kolders` · rama `main` · HEAD `0df926c` · 55 commits
Verificado contra producción: `clientes-tradicional-gf.vercel.app` sirve exactamente este código (título "KOLD Canal Tradicional", portada "KOLDOS / Portal Distribuidores").

**Cambio v2 (2026-07-04):** por decisión de Yamil, recompensas SÍ aplica a B2B, se promete desde la portada y el canje objetivo es automático. La sección 3 se reescribió en consecuencia y se agregaron: cuestionario ampliado de validación Odoo, especificación de endpoints `/api/rewards/*` y sección de integración con el bot de servicio 55 4000 0990.

---

## 1. Mapa del proyecto

### Framework y stack
| Capa | Tecnología |
|------|-----------|
| Framework | **Next.js 16.1.6** (App Router) + React 19.2.3 + TypeScript 5 |
| Estilos | Tailwind CSS 4 con tokens custom en `tailwind.config.ts` |
| Estado cliente | Zustand 5 con `persist` → localStorage (`kold-b2b-cart`) |
| PWA | Serwist 9 (service worker `src/app/sw.ts`, solo cache por defecto; deshabilitado en dev) |
| Iconos | lucide-react |
| Backend | **No hay BD propia.** Todo va contra **Odoo 18 vía JSON-RPC** (`/web/session/authenticate` + `/web/dataset/call_kw`) con usuario de servicio |
| Auth | Magic link por WhatsApp validado contra **n8n (workflow W15)** + JWT propio (jose, HS256) en cookie httpOnly 7 días |
| Deploy | **Vercel con auto-deploy en push a `main`** (`vercel.json` solo define buildCommand) |

*Nota:* el `package.json` interno todavía se llama `koldhome-canal-tradicional`; hay `@tanstack/react-query` instalado pero **no se usa en ningún archivo**, y `canvas` (dependencia pesada) solo lo usa el script suelto `generate_b2b_icons.js`.

### Estructura de carpetas
```
src/
  app/
    (public)/            → portada "/" (KOLDOS), /login (solo redirect), /auth (validación token)
    (protected)/         → layout con guard de cookie + BottomNav
      catalog/           → catálogo (pantalla principal de facto)
      cart/              → carrito + checkout integrado
      order/confirmed/   → confirmación de pedido
      account/           → cuenta (crédito, ejecutivo, menú)
      account/orders/    → historial de pedidos
      account/invoices/  → facturas + modal pago SPEI + PDF
    api/                 → 11 route handlers (server-side, ver abajo)
  components/BottomNav.tsx   → ÚNICO componente compartido de toda la app
  lib/  → odoo.ts, auth.ts, n8nAuth.ts, pricelist.ts, b2bIdempotency.ts, utils.ts
  store/cart.ts
docs/superpowers/        → spec y plan del rediseño visual "Clean Corporate" de 2026-06-06
raíz: AUDIT_REPORT.md, CATALOG_LOGIC.md, deploy-guide.md, scripts sueltos de prueba
```

### Rutas (pantallas)
| Ruta | Qué es | Estado |
|------|--------|--------|
| `/` | Portada pública "KOLDOS / Portal Distribuidores" con botón WhatsApp | Viva, **copy incorrecto** |
| `/login?token&phone` | Solo hace redirect a `/auth` con los mismos params | Viva (compatibilidad con links del bot) |
| `/auth?token&phone` | Valida magic link vs n8n, crea sesión, redirige a `/catalog` | Viva; incluye detector de WebView de WhatsApp con overlay "Abre en Safari" |
| `/catalog` | Catálogo agrupado por familia (Laurita/Kold) y subgrupo, buscador, +/− carrito | Viva — es el "home" de facto |
| `/cart` | Carrito + logística de entrega + método de pago + checkout | Viva |
| `/order/confirmed` | Confirmación (confirmed vs draft) con datos por query params | Viva |
| `/account` | Crédito, facturas vencidas, ejecutivo WA, menú | Viva |
| `/account/orders` | Historial 30 pedidos, detalle expandible, reordenar | Viva |
| `/account/invoices` | Facturas pendientes, semáforo vencimiento, PDF, modal SPEI | Viva |

**No existen:** home/inicio, recompensas, canje, perfil editable, soporte dedicado, tracking de entrega, onboarding.

### API routes (server) y su conexión a Odoo
| Endpoint | Fuente de datos | Notas |
|----------|----------------|-------|
| `POST /api/auth/verify` | n8n `pwa-auth-verify` → `partner_id` → firma JWT propio | El flujo vivo de login |
| `POST /api/auth/request-link` | n8n `pwa-auth-request` | **MUERTO: ningún componente lo llama** (el flujo OTP fue sustituido por el redirect a WhatsApp en commit `e084a4f`) |
| `POST /api/auth/verify-code` | n8n | **MUERTO** (flujo OTP retirado de la UI) |
| `POST /api/auth/logout` | — | Vivo |
| `GET /api/account/profile` | `res.partner` (name, vat, street, pricelist, credit, user_id) + teléfono real del ejecutivo (`res.users`→`res.partner`) | Vivo |
| `GET /api/catalog` | `product.product` + `product.category` + `product.packaging` + `product.pricelist.item` + `account.tax` + detección de imagen (`image_128`) | Muy trabajado: precios por pricelist del partner, IVA real por compañía, clasificación por `complete_name` |
| `POST /api/cart/validate` | Odoo | Pre-checkout: existencia, precio, stock |
| `POST /api/b2b/orders/create` | `sale.order` create | Hardened: idempotencia (`x_kold_idempotency_key`), warehouse por plaza (`x_warehouse_id` / `x_analytic_un_id`), impuestos por compañía, webhook n8n al ejecutivo. Autoconfirmación solo para pago a crédito dentro de límite |
| `GET /api/b2b/orders/history` | `sale.order` + `sale.order.line` (filtro `x_studio_canal_origen` con fallback) | Vivo |
| `GET /api/b2b/invoices` | `account.move` (not_paid/partial) | Vivo |
| `GET /api/b2b/invoices/[id]/pdf` | Proxy a Odoo report engine | Vivo, valida propiedad del partner |

### Autenticación y token (cómo funciona hoy)
1. El bot de WhatsApp (n8n, **55 4000 0990** — el mismo número hardcodeado en la portada como `wa.me/525540000990`) entrega al cliente un link `…/login?token=XXXXXX&phone=52…`.
2. `/login` redirige a `/auth`, que hace `POST /api/auth/verify` con token+phone.
3. El server valida contra n8n W15 (`pwa-auth-verify`); si es válido recibe `partner_id`.
4. Se firma un **JWT propio (HS256, `JWT_SECRET`) con `{partner_id, b2b:true, source}`** y se guarda en cookie `session` httpOnly/secure/lax, 7 días.
5. Todas las API routes releen esa cookie y validan `payload.b2b` antes de tocar Odoo. El layout `(protected)` solo verifica **presencia** de la cookie (la validez se verifica por API).
6. La detección de WebView de WhatsApp bloquea la validación dentro del in-app browser y muestra instrucciones para abrir en Safari/navegador (los 3 últimos commits trabajaron esto).

**Implicación clave para la visión v2:** el bot y la PWA **ya comparten identidad** — el mismo `partner_id` de Odoo resuelto por n8n. La base para "un solo servicio digital" ya existe; ver doc 05.

### Variables de entorno relevantes
Críticas: `ODOO_URL`, `ODOO_DB`, `ODOO_SERVICE_USER`, `ODOO_SERVICE_PASSWORD`, `JWT_SECRET`.
Auth n8n: `N8N_AUTH_BASE_URL` (o `N8N_AUTH_REQUEST_URL`/`N8N_AUTH_VERIFY_URL`), `NEXT_PUBLIC_CANAL_ORIGEN` (default `pwa_canal_tradicional`... con fallback `"gf"` en `n8nAuth.ts` que difiere del default documentado).
Pedidos: `N8N_WEBHOOK_ORDERS` (+fallbacks), `ODOO_COMPANY_ID` (fallback 34 = Glaciem).
Públicas: `NEXT_PUBLIC_WA_SALES`, `NEXT_PUBLIC_BANK_NAME/CLABE/BENEFICIARY`, `NEXT_PUBLIC_APP_URL`.
**No existe ninguna variable/flag relacionada con recompensas.** Se propone crear `REWARDS_MODE` (ver §3.3).

### Qué se despliega a Vercel
Todo `main`, automáticamente. No hay ramas de staging, no hay `vercel.json` con protecciones, no se detectó branch protection. **Cualquier push a `main` es producción en minutos.** Las ramas/PRs generan Preview Deployments aislados (no tocan producción), pero comparten env vars de preview — ver plan doc 04.

---

## 2. Funcionalidad ya existente (resumen)

| Módulo | ¿Existe? | Calidad |
|--------|----------|---------|
| Login/acceso (magic link WA + overlay WebView) | ✅ | Funcional; copy y marca mal |
| Home | ❌ | Post-login cae directo a `/catalog` |
| Catálogo | ✅ | El módulo más maduro (pricing por pricelist, IVA real, familias) |
| Carrito/checkout | ✅ | Sólido server-side (validate + idempotencia); UX con lenguaje corporativo |
| Historial + reordenar | ✅ | Funcional; el reorden pierde `tax_rate` y SKU (bug abajo) |
| Estado de cuenta (crédito + facturas + PDF + SPEI) | ✅ | Funcional |
| Perfil | ⚠️ Parcial | Solo nombre/RFC dentro de `/account`; sin dirección visible, sin ruta/zona |
| Soporte/asesor | ⚠️ Parcial | Botón WA del ejecutivo en `/account` y en confirmación; no hay pantalla de soporte ni integración formal con el bot |
| **Recompensas/puntos/canje** | ❌ | **Inexistente** (ver sección 3) |
| Promociones | ❌ | Nada |
| Tracking de entrega | ❌ | Descartado en el MVP original |
| Módulos ocultos/incompletos | Solo los 2 endpoints OTP muertos y `hashOtp()` en `lib/auth.ts` sin usar | — |

---

## 3. Recompensas B2B (v2 — decisión confirmada: SÍ va)

### 3.0 Hallazgo base (sin cambios)

**Método:** búsqueda de `reward|recompensa|loyalty|lealtad|puntos|points|benefit|beneficio|redenci|redeem|wallet|programa` sobre todo el working tree **y sobre los 55 commits del historial completo** (`git log -S`), más lectura de los 11 endpoints y las 10 pantallas.

**Resultado:** no existe código de recompensas — ni componente, ni ruta, ni endpoint, ni llamada a modelos loyalty de Odoo, ni env var, ni feature flag, ni condición por permisos. Nunca existió en el historial. El `AUDIT_REPORT.md` del repo (2026-04-03) lo excluyó a propósito ("lealtad es solo B2C"). **Esa exclusión queda REVERTIDA por decisión de producto de Yamil (2026-07-04).** Consecuencia: hay que (a) ampliar/configurar el programa en Odoo para B2B —territorio de Sebastián— y (b) construir el frente completo en la PWA. La infraestructura de conexión (`lib/odoo.ts`, patrón de sesión, validación de propiedad por partner) ya existe y sirve tal cual.

### 3.1 Validación en Odoo para extender recompensas a B2B (cuestionario para Sebastián)

Nada de esto debe asumirse: **validar contra el Odoo productivo antes de escribir código.** Ordenado por bloque:

**A. Estado del programa**
1. ¿Está activo el **loyalty nativo de Odoo 18** (`loyalty.program`, `loyalty.card`, `loyalty.reward`, `loyalty.rule`) o es un módulo custom `gf_*`? ¿Nombre e `id` exactos del/los programas?
2. ¿El programa actual está configurado solo para POS / eCommerce / B2C (KoldHome)? ¿Qué `trigger`/`applies_on` tiene?
3. ¿Puede aplicar a `sale.order` del canal tradicional (ventas backend creadas por usuario de servicio, no desde website)? En Odoo 18 los programas tipo "loyalty" aplican a ventas si el pedido pasa por el flujo que dispara `_update_programs` — **verificar si un `sale.order` creado por RPC acumula puntos automáticamente o requiere lógica adicional** (probable gap: los pedidos PWA se crean por RPC y podrían NO disparar acumulación nativa).
4. ¿Puede aplicar a clientes `company_type='company'` (B2B)? ¿Hay restricción de website/pricelist?

**B. Acumulación**
5. ¿Los puntos se acumulan al **confirmar pedido, facturar, entregar o pagar**? (decisión de negocio + configuración; recomendación: al facturar o entregar, para no premiar pedidos cancelados).
6. ¿Regla de acumulación: puntos por $ MXN, por unidad, por producto/categoría (¿solo hielo? ¿también Kold?)? ¿Redondeo?
7. ¿Programa por compañía (34 Glaciem) o multi-compañía / por plaza? ¿Un cliente de Guadalajara y uno de Iguala juegan el mismo programa?
8. ¿Los pedidos creados por el usuario de servicio (RPC) acumulan igual que los creados en UI?

**C. Modelo de datos**
9. ¿Qué modelo guarda el saldo de puntos por cliente? (nativo: `loyalty.card` con `points`, ligada a `partner_id` y `program_id`).
10. ¿Qué modelo guarda recompensas y canjes? (nativo: `loyalty.reward` define el premio; el canje se materializa como línea de descuento/producto en una orden con `coupon_id`; el historial en `loyalty.history` si está disponible en la versión, o hay que leer movimientos de otra forma). **Confirmar los modelos exactos y sus permisos.**
11. ¿Hay expiración de puntos (`expiration_date` en card/programa)? ¿Niveles de cliente? (si no hay niveles nativos, NO inventarlos en frontend).

**D. Reglas de negocio y control — DECIDIDAS por Yamil (2026-07-04); a Sebas le toca solo la implementación técnica**
12. ~~¿Bloqueo de canje por saldo vencido?~~ **DECIDIDO: NO en fase inicial** (canal mayoritariamente de contado; sin fricción financiera en el piloto). `customer_blocked` por vencidos desactivado. **Pendiente técnico:** que el método de canje deje el hook listo para activar esta regla después sin cambiar el contrato del endpoint.
13. ~~¿Límite de canjes por periodo?~~ **DECIDIDO: máximo 1 canje al mes por cliente.** Se valida **en Odoo, dentro del método atómico** — nunca en frontend. **Pendiente técnico (Sebas):** cómo contar el mes (mes calendario recomendado) y devolver `monthly_limit_reached` al exceder. Monto máximo por canje: no requerido en piloto.
14. ¿Cómo se descuentan puntos al canjear y qué registro queda (trazabilidad para auditoría)? — pendiente técnico.
15. ~~¿Cómo se refleja el canje en operación?~~ **DECIDIDO: dos modos iniciales** — producto gratis **con el siguiente pedido** y descuento **en la siguiente factura/pedido**. Entrega independiente en ruta queda FUERA de fase inicial. Cada recompensa lleva `delivery_mode`. **Pendiente técnico (Sebas):** cómo materializar cada modo (línea a precio 0 en el siguiente `sale.order` vs descuento en factura) y quién lo ve (ejecutivo/almacén).
16. **Reversa de puntos — DECIDIDO: SÍ existe.** Si se cancela el pedido que generó puntos, se revierten. Recomendación técnica confirmada: **abonar puntos al entregar/facturar/confirmar cumplimiento, NO al crear el pedido** (minimiza reversas — conecta con pregunta 5). **Pendiente técnico (Sebas): proponer la mecánica exacta** para el caso "puntos ya gastados en un canje antes de la cancelación": saldo negativo controlado, ajuste pendiente, o bloquear siguientes canjes hasta compensar. También: reversa del canje mismo (recompensa sin stock, error) ¿devuelve puntos y con qué registro?
17. ¿Stock de recompensas físicas: se controla en Odoo (producto con inventario) o es ilimitado? — pendiente técnico.

**E. Permisos e integración**
18. ¿El usuario de servicio de la PWA tiene permisos sobre los modelos loyalty? (primer paso concreto: probar `search_read` de `loyalty.card` por `partner_id`, read-only, sin tocar nada).
19. **¿Existe (o Sebas puede crear) un método servidor ATÓMICO de canje** — p.ej. `gf_loyalty_redeem(partner_id, reward_id, idempotency_key)` — que valide saldo, descuente puntos, registre el canje y devuelva folio en UNA sola transacción? Esto es la pieza clave del canje automático seguro (ver §3.2 y doc 05). Si no existe, la PWA tendría que hacer read-then-write en varias llamadas RPC = condición de carrera = doble canje posible. **Recomendación fuerte: el canje vive en Odoo como método único.**

### 3.2 Especificación de endpoints `/api/rewards/*` (PWA)

Principios: la PWA **nunca calcula ni almacena puntos** — solo muestra lo que Odoo responde. Todos los endpoints siguen el patrón existente (cookie `session` → `verifyToken` → `payload.partner_id` + `payload.b2b` → `callKw`). Ningún dato de otro partner puede salir (mismo patrón de ownership que invoices/pdf).

#### `GET /api/rewards/summary`
- **Input:** ninguno (identidad por cookie).
- **Output:** `{ program: {id, name}, balance: number, currency_label: "puntos", next_reward: {id, name, points_cost, points_missing} | null, expiring: {points, date} | null, level: {...} | null, blocked: {reason} | null }`. *(`blocked` en fase inicial es SIEMPRE `null` — el bloqueo por saldo vencido está desactivado por decisión de Yamil; el campo queda reservado para que una regla futura de Odoo pueda activarlo sin romper el contrato. La UI solo muestra bloqueos si Odoo los devuelve explícitamente.)*
- **Validaciones:** sesión válida; card pertenece al partner. Si el partner no tiene `loyalty.card` → `balance: 0, no_card: true` (estado legítimo, no error).
- **Errores:** 401 sin sesión; **502 si Odoo falla — NUNCA responder balance 0 por error** (la UI debe distinguir "tienes 0 puntos" de "no pudimos consultar").
- **Dependencias Odoo:** `loyalty.card` (points, program_id, expiration si existe), `loyalty.reward` (para next_reward).
- **Riesgos:** confundir card de otro programa (filtrar por program_id del programa B2B); cachear demasiado (mostrar saldo viejo tras un canje — usar `force-dynamic` como el resto).

#### `GET /api/rewards/catalog`
- **Input:** ninguno.
- **Output:** `[{ id, name, description, points_cost, reward_type: "product"|"discount", image_url, available: boolean, unavailable_reason: "out_of_stock"|"not_enough_points"|null }]` — incluye recompensas bloqueadas (para mostrarlas "en gris" con progreso, decisión de diseño doc 03).
- **Validaciones:** solo recompensas del programa activo B2B, activas y vigentes.
- **Errores:** 401, 502.
- **Dependencias Odoo:** `loyalty.reward` (+ stock del producto de regalo si aplica, pregunta 17).
- **Riesgos:** mostrar recompensa canjeable que operación no puede surtir (stock) → incluir disponibilidad desde el inicio.

#### `POST /api/rewards/redeem`
- **Input:** `{ reward_id: number, idempotency_key: string }` (la PWA genera la key igual que en pedidos).
- **Output éxito:** `{ folio, reward_name, points_spent, new_balance, delivery: { mode: "next_order" | "discount_next_invoice", instructions: string } }`. *(Modos de entrega DECIDIDOS: producto gratis con el siguiente pedido, o descuento en la siguiente factura/pedido. El modo `"route"` — entrega independiente en ruta — queda FUERA de la fase inicial; se documenta solo como valor futuro posible.)*
- **Validaciones (server PWA):** sesión, `reward_id` numérico. **Todo lo demás lo valida Odoo dentro del método atómico** (saldo suficiente, recompensa activa, stock, **límite mensual no excedido**, key no usada).
- **Errores (contrato):** 401 sesión · 400 input · **409 `insufficient_points`** (con saldo actual) · **410 `reward_unavailable`** (agotada/inactiva) · **429 (o 409) `monthly_limit_reached`** — DECIDIDO: máx. 1 canje/mes, validado en Odoo; copy: *"Ya usaste tu canje de este mes. Podrás canjear otra recompensa el próximo mes."* · **409 `duplicate` → responder el folio ORIGINAL como replay, no error al usuario** · 502 Odoo caído (con garantía explícita: "no se descontaron puntos"). *(`423 customer_blocked` NO existe en fase inicial — bloqueo por saldo vencido desactivado por decisión de Yamil; se reserva en el contrato como error futuro activable desde Odoo sin cambiar la PWA.)*
- **Dependencias Odoo:** el método atómico de la pregunta 19. **Sin ese método, este endpoint no se construye** (no se acepta read-then-write en 2+ llamadas).
- **Riesgos:** doble canje por doble tap/reintento (mitigado por idempotency_key + constraint en Odoo); canje con saldo desactualizado (mitigado porque el saldo se valida DENTRO de la transacción Odoo, no con el número que ve la UI); abuso (límite por periodo en Odoo, pregunta 13).

#### `GET /api/rewards/history`
- **Input:** `?limit=20`.
- **Output:** `[{ date, type: "earn"|"redeem"|"expire"|"adjust", points: +/-N, reference: "Pedido S00123" | "Canje: Bolsa Rolito 5kg" | ..., folio? }]`.
- **Errores:** 401, 502.
- **Dependencias Odoo:** `loyalty.history` (o el modelo que confirme Sebas; si el nativo no da historial legible, pedir a Sebas una vista/modelo de movimientos — sin historial el programa pierde credibilidad ante el tendero).
- **Riesgos:** historial incompleto (acumulaciones sin referencia) → definir formato de referencia desde Odoo.

#### Qué se puede simular si Odoo no está listo — `REWARDS_MODE`
Variable server `REWARDS_MODE = off | teaser | live`:
- `off`: la UI no muestra nada de puntos (ni tab).
- `teaser`: la UI muestra la promesa ("Muy pronto: gana puntos por cada pedido") **sin números** — cero datos falsos. La portada puede prometer recompensas (decisión Yamil) porque promete el programa, no un saldo.
- `live`: consume los endpoints reales.
**Prohibido** (restricción de Yamil, correcta): simular saldos/puntos falsos en producción. En previews de Vercel puede apuntarse a un partner de prueba con card real de pruebas en Odoo, nunca mocks con números inventados visibles como reales.

### 3.3 Riesgos específicos del canje automático

| Riesgo | Mitigación |
|--------|-----------|
| **Doble canje** (doble tap, reintento de red, dos dispositivos) | Idempotency key + unique constraint + método atómico en Odoo (patrón ya probado en `orders/create` con `x_kold_idempotency_key`) |
| **Carrera saldo** (dos canjes simultáneos con saldo para uno) | El saldo se valida dentro de la transacción Odoo, nunca en frontend |
| **Programa mal configurado regala de más** (regla de puntos generosa por error) | Piloto con recompensas de bajo costo + **límite DECIDIDO de 1 canje/mes (validado en el método atómico de Odoo)** + monitoreo primeras semanas (query diaria de canjes) |
| **Canje sin capacidad operativa** (recompensa sin stock) | `available` desde Odoo + `delivery_mode` explícito en el folio (solo `next_order` / `discount_next_invoice` en fase inicial) + visibilidad para el ejecutivo (notificación n8n como en pedidos) |
| **Reversa** (pedido que generó puntos se cancela después del canje) | **DECIDIDO: la reversa existe.** Mitigación estructural: abonar puntos al entregar/facturar, no al crear pedido. Mecánica exacta del caso "puntos ya gastados" (saldo negativo controlado / ajuste pendiente / bloquear canjes hasta compensar) la propone Sebas en Odoo — pregunta 16 |
| **Abuso de canjes** | Cubierto por el límite 1 canje/mes. El bloqueo por saldo vencido queda DESACTIVADO en fase inicial (decisión de negocio: canal de contado); la arquitectura lo deja activable después |
| **Saldo mostrado ≠ saldo real** (momento de acumulación confuso) | Copy explícito: "los puntos se abonan cuando se entrega/factura tu pedido" según regla elegida (pregunta 5) |

### 3.4 Fase técnica intermedia admisible

La arquitectura objetivo es canje automático. Si el método atómico de Odoo (pregunta 19) tarda, la **única** fase intermedia aceptable es: `redeem` crea la solicitud en Odoo (registro con folio, SIN descontar puntos aún) + notificación n8n al ejecutivo, y la UI lo muestra como "Canje en proceso". Nunca lanzar un canje "automático" hecho con read-then-write en múltiples RPC — es la versión con condición de carrera.

---

## 4. PWA + Bot de Servicio 55 4000 0990 (n8n) — análisis de integración

*(Resumen ejecutivo; la arquitectura completa está en el doc 05.)*

**Hecho clave:** el bot y la PWA ya están conectados hoy más de lo que parece:
- La portada de la PWA manda al bot (`wa.me/525540000990`) para pedir acceso.
- El bot entrega los magic links (`/login?token&phone`).
- El login de la PWA se valida contra n8n (W15) — n8n ya sabe mapear teléfono → `partner_id`.
- La PWA notifica pedidos nuevos a n8n (`N8N_WEBHOOK_ORDERS`) para avisar al ejecutivo.

Es decir: **la identidad y el ciclo de vida del cliente ya fluyen por n8n.** Lo que falta es diseño de producto para que se sienta un solo servicio.

**Respuestas puntuales a las preguntas planteadas:**

| Pregunta | Recomendación |
|----------|---------------|
| ¿La PWA debe mandar al bot para soporte? | **Sí, como primer nivel.** Botón "Ayuda por WhatsApp" con mensaje pre-llenado e identificado (nombre de tienda + contexto: pedido/puntos/recompensa). El asesor humano (ejecutivo) queda como segundo nivel visible |
| ¿El bot debe entregar magic links? | **Ya lo hace.** Formalizarlo: cualquier intent tipo "quiero entrar a mi portal" responde el link. Es EL mecanismo de auth |
| ¿El bot debe consultar pedidos? | Sí — n8n consulta Odoo (`sale.order` por partner) y responde estado. Regla: misma fuente que la PWA (Odoo), nunca estado propio |
| ¿El bot debe consultar puntos? | Sí — mismo dato que `/api/rewards/summary`, leído de Odoo. Ideal: n8n llama el MISMO método/consulta Odoo (no una copia de la lógica) |
| ¿El bot debe iniciar canjes? | **Fase 2 del bot.** Técnicamente sí (llamando el MISMO método atómico `gf_loyalty_redeem` de Odoo). Lanzar primero el canje en PWA, medir, luego habilitar en bot — el canje conversacional necesita confirmación robusta para no canjear por malentendido del LLM. El bot puede desde el día 1 *responder* saldo y *linkear* a la PWA para canjear |
| ¿La PWA debe mostrar "Contactar por WhatsApp"? | Sí, en home, soporte y confirmación de pedido (parcialmente ya existe con el ejecutivo) |
| ¿El bot debe compartir lógica con la PWA? | **Sí, vía Odoo, no copiándose código.** La regla de negocio vive en Odoo; PWA y n8n son dos clientes del mismo método |
| ¿Conviene centralizar servicios en endpoints comunes? | La capa común es Odoo (métodos modelo). NO conviene que n8n llame a los `/api/*` de la PWA (acoplaría el bot al deploy de Vercel y a cookies de sesión que no tiene). Ver doc 05 |
| ¿Riesgo de reglas diferentes entre PWA y bot? | **Alto si no se gobierna.** Ya hay un precedente en el repo: la PWA calcula IVA real y el server aún asume 16% en un punto. Mitigación: regla escrita "toda regla de puntos/precios/canje vive SOLO en Odoo" + tests de consistencia (mismo partner, misma respuesta por ambos canales) |
| ¿Qué vive dónde? | **Odoo:** verdad y reglas (puntos, saldos, canjes, precios, crédito). **n8n:** orquestación conversacional, auth por WhatsApp, notificaciones. **Frontend (PWA):** experiencia visual, cero reglas de negocio. Detalle en doc 05 |

---

## 5. Riesgos técnicos detectados (sin cambios v2 + 1 adición)

### Bugs reales
| # | Riesgo | Dónde | Detalle |
|---|--------|-------|---------|
| B1 | **Crash (pantalla en blanco) en `/account` si falla el perfil** | `account/page.tsx:50` | Tras `loading=false`, si el fetch falló `partner` es `null` y `partner.credit_limit` lanza TypeError. Cliente con red débil ve pantalla rota |
| B2 | **Reordenar calcula mal el IVA mostrado** | `account/orders/page.tsx:30-43` | `handleReorder` agrega líneas **sin `tax_rate`** (y sin SKU), así que el carrito muestra IVA $0 para pedidos reordenados aunque Odoo sí lo cobrará. El total visible ≠ total real |
| B3 | **Fetch de facturas en cada navegación** | `BottomNav.tsx:14-24` | El nav dispara `GET /api/b2b/invoices` (RPC a Odoo) en **cada cambio de ruta**, solo para pintar un puntito rojo |
| B4 | Bloque de crédito muerto en carrito | `cart/page.tsx:266-282` | El `<select>` solo ofrece efectivo/tarjeta, pero queda el bloque condicional `paymentMethod === 'credito'` y la autoconfirmación server-side solo aplica a crédito → hoy **ningún pedido PWA se autoconfirma** (¿intencional?) |
| B5 | `total_con_iva` server asume 16% | `orders/create/route.ts:385` | El server calcula `subtotal * 1.16` para el check de crédito, contradiciendo la política "no inventar IVA" del catálogo |

### Código muerto / higiene
- Endpoints OTP muertos: `api/auth/request-link`, `api/auth/verify-code`, más `hashOtp()` en `lib/auth.ts`. **Antes de borrar: confirmar en n8n que ningún workflow los llama.**
- Dependencias sin uso: `@tanstack/react-query`, `odoo-xmlrpc`, `canvas` + `dotenv` (solo scripts sueltos).
- Basura en raíz versionada: `build_err.txt`, `test-*.js`, `test_odoo.mjs`, `buildLayout.js`, `generate_b2b_icons.js`, `next.config.ts` duplicado junto a `next.config.js`, README default, SVGs de plantilla en `public/`.
- `manifest.json` con marca vieja ("KOLD Distribuidores"), tema `#0066FF` desalineado de la paleta actual.

### Hardcodeos y textos incorrectos
- Portada: "KOLDOS", "Portal Distribuidores", "Recibir Enlace KOLD" (`(public)/page.tsx:19,20,37`).
- **Número del bot hardcodeado** (`525540000990`, `page.tsx:3`) → mover a `NEXT_PUBLIC_WA_BOT`.
- Fallbacks bancarios peligrosos en `invoices/page.tsx`: CLABE falsa `012345678901234567` mostrada como real si faltan env vars. **Ocultar el modal si no hay CLABE configurada.**
- Teléfono fallback `5218110000000` repetido en 3 archivos.
- Copy técnico visible: "Procesar Orden B2B", "Auditoría de Pedidos", "Términos Comerciales", "Validando tu acceso de Distribuidor...", "Token de acceso no válido", "(B2B)" en mensajes de WA.
- `layout.tsx` metadata: "KOLD Canal Tradicional / Portal B2B para socios KOLD".

### Seguridad / operación
- **Auto-deploy a producción desde `main` sin PR obligatorio** — riesgo #1 operativo.
- **Token en URL** (query `?token&phone`): historial del navegador, logs. Mitigar: TTL corto y un solo uso en W15 (verificar), `history.replaceState` tras validar.
- Sin rate limiting en `/api/auth/verify` (verificar si W15 limita).
- La sesión de servicio Odoo ve todas las compañías → **cada endpoint nuevo de rewards debe repetir el patrón de validación de propiedad por partner** (mismo estándar que invoices/pdf).
- PWA `start_url: "/"`: el cliente con sesión cae en la portada de marketing (la portada no redirige a home).
- Catálogo lee `image_128` de todos los productos por request (aceptable solo en piloto).
- **(Nuevo v2)** El canje automático agrega superficie de escritura a Odoo desde la PWA. Regla: la PWA solo escribe vía métodos atómicos dedicados (pedidos ya lo hace con `create` controlado; canje con `gf_loyalty_redeem`), jamás `write` directo sobre `loyalty.card.points`.

### Responsive / estados
- Layout global `max-w-md` — correcto mobile-first.
- Estados: catálogo ✅ completo; historial y facturas ✅ empty pero ⚠️ sin estado de error (un fallo de red muestra "Sin pedidos aún" / "Al corriente" — mentira peligrosa en facturas); `/account` ❌ (crash B1); carrito ✅.
