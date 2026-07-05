# Entregable 4 — Plan de implementación (v2, recompensas como parte central) + MVP

## El riesgo que gobierna todo (sin cambios)

`grupofrio/clientes-tradicional-kolders` despliega **automáticamente a producción en cada push a `main`**. No hay staging. Por lo tanto: **nada se pushea a `main` directamente, nunca.** Todo entra por rama + PR + Vercel Preview + aprobación de Yamil. Las ramas y PRs generan Preview Deployments aislados que NO tocan producción.

### Blindaje previo (antes del primer commit de código)
1. **Branch protection en `main`** (GitHub → Settings → Branches): require PR, prohibir push directo. Lo activa quien tenga admin del repo.
2. **(Reforzado por Codex)** Verificar en Vercel si los **Preview Deployments heredan las env vars de producción** (Odoo productivo). Regla dura: **un preview NO debe poder crear pedidos/canjes reales contra Odoo productivo salvo allowlist explícita** — guard server-side (`VERCEL_ENV === 'preview'` → bloquear mutaciones salvo `partner_id` en `PREVIEW_MUTATIONS_ALLOWLIST` con partner de prueba dedicado). Mientras ese guard no exista, en previews solo se prueba hasta el carrito (nunca confirmación), y cualquier pedido de prueba coordinado se cancela en Odoo de inmediato.
3. Convención: **1 PR = 1 etapa**, PRs chicos y revisables (por Yamil, ChatGPT y Codex).
4. Rollback documentado: **Vercel → Deployments → "Promote to Production"** del deployment anterior (instantáneo, sin git).

---

## Plan por PRs (v2)

| PR | Rama sugerida | Contenido | Archivos probables | Riesgo | Dependencias |
|----|---------------|-----------|--------------------|--------|--------------|
| **PR 0** | `audit/pwa-clientes-b2b-rewards` | **SOLO documentación** (esta auditoría v2, docs 01-05) para revisión de Yamil, ChatGPT y Codex. Sin código. | `auditoria_pwa_clientes/*.md` | Nulo | — |
| **PR 1** | `fix/estabilidad-confianza` | **Solo estabilidad/confianza** — lista final cerrada tras auditoría Codex (ver sección "Lista final PR 1" abajo): null-safe en `/account`, reorden rehidratado desde catálogo, eliminar `subtotal*1.16` en `orders/create`, fetch controlado del BottomNav, política de pago unificada en carrito, fallbacks falsos fuera de invoices, error ≠ empty en listados, y guardrails mínimos de mutaciones (rate limit, Origin/Referer, CSRF-equivalente, preview mutation guard). Endpoints OTP muertos: solo si n8n confirma que nadie los llama. | `account/page.tsx`, `account/orders/page.tsx`, `account/invoices/page.tsx`, `BottomNav.tsx`, `cart/page.tsx`, `api/b2b/orders/create/route.ts`, middleware/guards | Bajo-Medio | Confirmación n8n para OTP |
| **PR 2** | `feat/rebranding-grupofrio` | Rebranding completo: quitar KOLDOS/"Portal Distribuidores", portada nueva **con promesa de recompensas (opción B, en modo TEASER: sin puntos numéricos, sin saldos falsos, sin recompensas canjeables falsas mientras Odoo no esté live)**, logo GF, paleta GF (tokens), tipografías vía `next/font`, copy institucional, manifest/title/íconos PWA, `NEXT_PUBLIC_WA_BOT`. **(Codex) Redirect con sesión: `/`→`/catalog` (ruta estable existente) — NO apuntar `start_url` ni redirects a `/home` mientras no exista; cuando PR 3 cree `/home`, ahí se mueve el destino.** | `(public)/page.tsx`, `tailwind.config.ts`, `globals.css`, `layout.tsx`, `manifest.json`, `public/icon-*`, todas las pages (copy) | Medio (todo lo visible, cero lógica) | PR 1 (guardrails), logo en buena resolución |
| **PR 3** | `feat/home-recompra-puntos` | Home nuevo: card repetir pedido, card de puntos, recompensa destacada, frecuentes, último pedido, botón WhatsApp. BottomNav 5 tabs. **Modo `REWARDS_MODE=off|teaser|live`**: las cards de puntos degradan con elegancia si rewards aún no responde (teaser sin números; error explícito, nunca saldo falso). | `(protected)/home/page.tsx` 🆕, `BottomNav.tsx`, `account/orders/page.tsx`, `api/b2b/orders/history` (param limit) | Medio | PR 2 |
| **PR 4** | `feat/rewards-readonly` | `GET /api/rewards/summary` + `/catalog` + `/history` (spec doc 01 §3.2) + pantalla `/rewards` completa (saldo, progreso, catálogo con bloqueadas, historial, reglas) + widgets live en home/confirmación. Fallback seguro: cualquier fallo Odoo → estado de error, jamás 0 silencioso. | `api/rewards/*` 🆕, `(protected)/rewards/page.tsx` 🆕, `home`, `order/confirmed` | Medio | **Validaciones Odoo A-C del cuestionario + permisos usuario servicio (Sebas)** |
| **PR 5** | `feat/rewards-canje-automatico` | `POST /api/rewards/redeem` + flujo `/rewards/redeem/[id]` (confirmación, folio, instrucciones de entrega, estados de error incl. `monthly_limit_reached`) + webhook n8n a operación + idempotencia. Reglas de negocio YA decididas (README): 1 canje/mes en Odoo, sin bloqueo por vencidos, reversa sí, `delivery_mode` next_order/discount_next_invoice. | `api/rewards/redeem` 🆕, `rewards/redeem/[id]/page.tsx` 🆕 | **Alto** (escritura en Odoo) | **Validación técnica de Sebastián/Odoo: método atómico `gf_loyalty_redeem` (con límite mensual dentro), mecánica de reversa y materialización del `delivery_mode` + catálogo piloto de recompensas autorizado por operación/comercial/finanzas (hoy no hay presupuesto formal — bloquea el live, no el desarrollo). Naming (Codex): sin método atómico, esto se llama y se muestra como "solicitud de canje", no "canje automático"** |
| **PR 6** | `feat/bot-integrado` | Pantalla `/support` + CTAs contextuales de WhatsApp identificado en toda la app (deep links con mensaje pre-llenado: pedido/puntos/recompensa/pago) + botón "Contactar a Grupo Frío" en home. Del lado n8n (fuera de este repo): intents de consulta de pedidos/puntos en el bot — se coordina como cambio n8n aparte. | `(protected)/support/page.tsx` 🆕, `home`, `account/page.tsx` | Bajo (PWA) / Medio (n8n) | Doc 05 aprobado; cambios n8n con su propio S/N |
| **PR 7** | `chore/pulido-enterprise` | Micro-animaciones sutiles (confirmación, canje), skeletons en todas las pantallas, empty states ilustrados, accesibilidad (contraste, tamaños touch, `aria`), QA visual, Lighthouse ≥90, limpieza (deps sin uso, archivos sueltos de raíz, `next.config.ts` duplicado, README real), métricas de adopción. | raíz, `package.json`, todas las pages | Bajo | Todo lo anterior |

### Lista final PR 1 (cerrada tras auditoría Codex, archivo por archivo)

1. **`src/app/(protected)/account/page.tsx`** — null-safe si falla `/api/account/profile`: mostrar error + reintentar + opción de cerrar sesión; nunca pantalla blanca.
2. **`src/app/(protected)/account/orders/page.tsx`** — Reordenar: no mandar `sku: ""`; **preservar o rehidratar `tax_rate`, SKU y precio desde catálogo/Odoo** (no confiar en los datos históricos del pedido); si un producto ya no existe o no está disponible, bloquear esa línea o sugerir alternativa — nunca agregarla rota al carrito.
3. **`src/app/api/b2b/orders/create/route.ts`** — **eliminar `total_con_iva = subtotal * 1.16`**; usar el total real de Odoo/server (`amount_total` releído, o cálculo con `tax_rate` reales) para el check de crédito, la autoconfirmación y la respuesta. (Con IVA 0% real en productos GF, el hardcode infla el total 16%.)
4. **`src/components/BottomNav.tsx`** — quitar el fetch de `/api/b2b/invoices` en cada navegación; cachear, mover a la pantalla de cuenta, o consultar de forma controlada (p.ej. una vez por sesión / TTL).
5. **`src/app/(protected)/cart/page.tsx`** — **unificar la política de pago**: resolver la rama muerta `paymentMethod === 'credito'`; UI y server alineados en el set real (efectivo/tarjeta/crédito) — decidir con Yamil si crédito se ofrece o se elimina de ambos lados.
6. **`src/app/(protected)/account/invoices/page.tsx`** — quitar los fallbacks falsos de CLABE/banco/beneficiario/WhatsApp; si faltan las env reales, **ocultar** las instrucciones de pago o mostrar mensaje seguro ("pídele los datos de pago a tu asesor").
7. **Historial e invoices** — el error de red no debe confundirse con empty state ("Sin pedidos aún" / "Al corriente" falsos): mostrar error + reintentar.
8. **Auth y mutaciones — guardrails mínimos antes de sumar rewards:** rate limit; Origin/Referer guard; protección CSRF o equivalente; **preview mutation guard/allowlist** (mutaciones reales bloqueadas en `VERCEL_ENV=preview` salvo partner de prueba allowlisted).

**Cambio clave vs v1:** rewards deja de ser "después del MVP" — el home (PR 3) nace **rewards-ready** con modo teaser, los endpoints read-only (PR 4) van inmediatamente después del home, y el canje automático (PR 5) es parte del plan base, no fase 2. Lo único que ordena la secuencia es la dependencia dura de Odoo (Sebas), no la prioridad de producto.

### Paralelización realista
- PR 1 y PR 2 pueden avanzar **ya**, sin esperar a Odoo.
- El cuestionario Odoo (doc 01 §3.1) se manda a Sebas **hoy** — es el camino crítico de PR 4/5.
- PR 3 se construye en paralelo a las respuestas (modo teaser lo desacopla).
- El diseño del método atómico de canje (doc 05 §4) se acuerda con Sebas mientras PR 3-4 avanzan.

## Checklist QA por PR (en Vercel Preview, en teléfono real)

- [ ] Login con magic link real (y link vencido → mensaje humano).
- [ ] Link dentro de WhatsApp → overlay "Abre en Safari" funciona (iOS y Android).
- [ ] Catálogo: precios = pricelist del partner de prueba.
- [ ] Carrito: totales con IVA correcto, **incluido carrito armado con "Repetir pedido"**.
- [ ] NO confirmar pedidos/canjes reales en preview salvo prueba coordinada (Odoo es productivo) — si se crea, cancelar en Odoo de inmediato.
- [ ] `/account` con partner sin crédito, sin facturas y con red fallando → sin pantalla blanca.
- [ ] Rewards: partner SIN card (0 pts legítimo) vs Odoo caído (error explícito) — la UI los distingue.
- [ ] Canje: doble tap → un solo folio; canje con saldo insuficiente simulado → error correcto sin descuento.
- [ ] PWA instalada: ícono GF, splash, `start_url`, sesión persistente.
- [ ] Lighthouse mobile ≥ 90.
- [ ] Grep de copy prohibido en build: `KOLDOS|Distribuidores|B2B|token|Procesar Orden` — cero visibles al cliente.

## Qué aprueba Yamil antes de cada merge

1. URL del Vercel Preview probada por él en su teléfono.
2. Diff de copy (qué decía / qué dice).
3. Para PR 4: confirmación de Sebas (programa correcto, permisos, momento de acumulación).
4. Para PR 5 — **las decisiones de negocio YA están confirmadas (Yamil, 2026-07-04):** sin bloqueo por saldo vencido en fase inicial · máximo 1 canje al mes (validado en Odoo) · reversa de puntos si se cancela el pedido · modos de entrega: con el siguiente pedido o descuento en siguiente factura/pedido. **Lo único pendiente para PR 5 es la validación técnica de Sebastián/Odoo:** método atómico `gf_loyalty_redeem`, mecánica exacta de reversa y materialización del `delivery_mode`.
5. S/N final. Sin S/N no hay merge (main = producción).

---

## Entregable 5 — MVP recomendado (v2)

### MVP = PR 1 + PR 2 + PR 3 + PR 4 (rewards read-only en vivo)

**Lo que el tendero ve el día del lanzamiento:**
1. Portada institucional Grupo Frío **prometiendo pedidos + puntos + recompensas** (decisión Yamil).
2. Home con "Repetir mi pedido de siempre" al frente.
3. **Sus puntos reales y el catálogo de recompensas visibles** (aunque el canje llegue 1-2 sprints después, ver progreso ya fideliza; el botón muestra "Muy pronto podrás canjear desde aquí" + canje vía asesor/bot como puente).
4. Historial con reordenar arreglado; Mis pagos con tono correcto.
5. Ayuda con bot + asesor (si PR 6 no llega al corte, el botón simple de WhatsApp identificado se adelanta a PR 3 — es barato).
6. Cero KOLDOS, cero pantallas rotas, cero CLABE falsa.

**Criterio del corte:** el MVP incluye TODO lo que no depende de Sebas más la capa read-only de rewards, que es la primera pieza con dependencia Odoo. El canje (PR 5) entra inmediatamente después, cuando (a) exista el método atómico — sin él solo puede lanzarse como **"solicitud de canje"**, nunca nombrado "automático" — y (b) exista **catálogo piloto de recompensas autorizado por operación/comercial/finanzas** (hoy no hay presupuesto formal: es el gate del live, no del desarrollo). Si Odoo se retrasa, el mismo MVP sale con las cards en `teaser` — la promesa de portada se sostiene porque el programa es inminente, y **jamás se muestran puntos falsos**.

### Fase 2 (post-MVP)
- PR 5 canje automático (si no alcanzó el corte) y PR 6 bot integrado completo (intents de puntos/pedidos en n8n).
- Canje conversacional por WhatsApp (bot inicia canje llamando el mismo método atómico) — después de medir el canje en PWA.
- Puntos por producto en catálogo + "ganarás X pts" en carrito.
- Fotos reales de producto (`image_128` en Odoo — tarea de datos).
- Notificaciones push ("tus puntos están por vencer", "tu pedido va en ruta").
- Tracking de entrega; promociones/banners administrables; niveles del programa si Odoo los soporta.
- Rate limiting en `/api/auth/verify` + limpiar token de la URL post-validación.

### Métricas para saber si funcionó
- % de pedidos del canal por PWA (medible ya con `x_kold_order_source='pwa_b2b'`).
- Tasa de recompra mensual PWA vs no-PWA.
- % de pedidos con "Repetir pedido".
- % de clientes activos que abren `/rewards` cada semana.
- Canjes completados / clientes activos; tiempo canje→entrega.
- Contactos al bot identificados desde la PWA (medible por el prefijo del mensaje).
