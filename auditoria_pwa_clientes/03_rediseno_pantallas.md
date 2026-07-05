# Entregable 3 — Rediseño estratégico (v2): Plataforma Digital de Clientes Grupo Frío

## Concepto de producto

Deja de ser "portal para pedidos" y se convierte en **la herramienta B2B del tendero**, con recompensas como eje central. Tres ideas, en este orden, en cada pantalla que lo permita:

1. **Pide fácil** — el pedido de siempre en 3 toques.
2. **Gana puntos** — cada compra se ve como progreso.
3. **Canjea recompensas** — beneficios reales, canje automático, sin tramitología.

Y una cuarta transversal: **un solo servicio digital** — la app y el bot de WhatsApp (55 4000 0990) son la misma cosa vista desde dos pantallas.

Regla de oro del copy: hablar como el repartidor de confianza, no como el ERP. Nada de "orden", "B2B", "portal distribuidores", "token", "dashboard".

## Nueva arquitectura de navegación

```
BottomNav (5 tabs):  Inicio · Pedir · Puntos · Ayuda · Mi cuenta
                     Carrito como barra flotante contextual (como hoy)

/                    → Portada pública (marca GF + promesa completa + CTA)
/auth                → igual que hoy (con copy nuevo)
/home        NUEVA   → centro del cliente (repetir pedido, puntos, recompensa destacada)
/catalog             → "Pedir" (mejorado)
/cart                → carrito/confirmación (copy nuevo + puntos estimados)
/order/confirmed     → confirmación + puntos ganados
/rewards     NUEVA   → Mis puntos (estratégica: saldo, progreso, catálogo recompensas, historial)
/rewards/redeem/[id] NUEVA → detalle + canje automático + folio
/account             → Mi cuenta (perfil + pagos + pedidos)
/account/orders      → historial (reordenar arreglado)
/account/invoices    → "Mis pagos" (tono suavizado)
/support     NUEVA   → Ayuda: bot WhatsApp + asesor humano
```

Flujo ideal del cliente recurrente: **abre app → /home → "Repetir mi pedido de siempre" → ajusta → confirmar → "+120 puntos, te faltan 140 para tu recompensa" → cierra.** Menos de 60 segundos, y cada ciclo alimenta el hábito.

## Sistema visual (v2 — ambición "primer mundo, no juguete ni ERP")

Identidad verificada en grupofrio.mx: **cian hielo `#00E5FF` + azul `#0077BB`** (+ `#00B8D4`, `#0099CC`), logo "Grupo Frío" disponible en `/web/image/website/1/logo/Grupo Frío`.

| Token | Valor | Uso |
|-------|-------|-----|
| `primary` | `#0077BB` | Botones principales, links, tab activo |
| `primary-deep` | `#005A8D` | Extremo oscuro de gradientes de header |
| `ice` (accent) | `#00B8D4` | Acentos, highlights (el `#00E5FF` puro solo en detalles: muy claro para texto/botón) |
| `background` | `#F0F9FF` | Fondo app (azul hielo casi blanco) |
| `card` / `border` | `#FFFFFF` / `#DBEFF9` | Cards y bordes suaves |
| `foreground` | `#0F2A3D` | Texto principal (azul petróleo) |
| `success/warning/danger` | `#10B981` / `#F59E0B` / `#EF4444` | Mantener |
| `points` | dorado `#F59E0B`→`#FBBF24` | **Color exclusivo del mundo puntos/recompensas** — nunca se usa para otra cosa |

**Principios de la ambición v2:**
- **Institucional + moderno:** gradiente de marca `#005A8D→#00B8D4` en headers, logo GF presente, blancos generosos, cards `rounded-2xl shadow-sm`.
- **Gamificación ligera, no juguetona:** progreso (barras, "+X pts" al confirmar, recompensas grises que se desbloquean) SÍ; avatares caricatura, confeti permanente, badges infantiles NO. Una sola animación de celebración breve al confirmar pedido/canje (micro-interaction, <1s) es suficiente.
- **Claridad operativa B2B:** números grandes y legibles (precio, total, puntos), estados de pedido con lenguaje llano, cero jerga.
- **Tipografía:** Inter + DM Sans ya declaradas — **hoy no se cargan** (declaradas en CSS sin import); cargarlas vía `next/font` o el diseño renderiza system font.
- **Estados visuales:** skeletons (no spinners solitarios), empty con acción, error humano + reintentar. Prohibido que un fetch fallido caiga en un empty state.
- Referencia mental: apps B2B de tenderos de primer nivel (pedidos Coca-Cola/Bimbo) + limpieza de app fintech, con frío/hielo como personalidad.

---

## Pantallas (12)

Formato: objetivo · estructura · copy/CTAs · estados · datos backend · qué es implementable ya vs qué depende de Odoo/rewards.

### 1. Portada / Login (`/`) — promete recompensas desde el día 1 (decisión Yamil, opción B)

- **Objetivo:** confianza en 3 segundos + vender que Grupo Frío ofrece algo que ninguna otra hielera da.
- **Estructura:** logo Grupo Frío grande → eyebrow "PORTAL DE CLIENTES" → h1 "Grupo Frío" → **promesa central:** *"Haz tus pedidos, gana puntos y canjea recompensas con Grupo Frío."* → 4 bullets con ícono: 🛒 *Pide fácil desde tu celular* · ⭐ *Cada compra suma puntos* · 🎁 *Canjea beneficios para tu tienda* · 🔒 *Acceso seguro por WhatsApp* → CTA → nota de funcionamiento.
- **CTA principal:** con sesión activa el server redirige directo a `/home` (o botón `Ingresar a mi portal`); sin sesión: `Recibir enlace de acceso` (botón WhatsApp verde → bot 55 4000 0990 vía `NEXT_PUBLIC_WA_BOT`).
- **CTA secundario:** "¿Cómo funciona?" (modal 3 pasos: pide tu enlace al asistente → entra con un toque → pide y gana puntos).
- **Estados:** estática; sin loading/empty/error.
- **Backend:** ninguno.
- **Implementable ya:** 100%. La promesa de puntos se lanza aunque rewards esté en `teaser` — promete el programa, no un saldo. **Quick win #1.**

### 2. Home (`/home`) — NUEVA, tres protagonistas

- **Objetivo:** recompra en mínimos toques + puntos como razón de volver.
- **Protagonistas en orden:** ① Repetir mi pedido de siempre ② Mis puntos ③ Recompensa disponible.
- **Estructura:**
  1. Header gradiente GF: logo pequeño + *"Hola, Abarrotes Lupita"*.
  2. **Card principal — Repetir pedido:** *"Repite tu último pedido"* + resumen 2-3 líneas ("3× Rolito 5kg · 2× Barra…") + total estimado + botón `Repetir este pedido`. Cliente nuevo → `Hacer mi primer pedido`.
  3. **Card de puntos (dorada):** *"Tienes ⭐ 1,240 puntos"* + barra de progreso *"Te faltan 260 puntos para tu próxima recompensa"* + link `Ver mis recompensas`. En modo `teaser`: *"Muy pronto: tus compras sumarán puntos"* sin números. En error de consulta: *"No pudimos consultar tus puntos — reintentar"* (nunca mostrar 0 por error).
  4. **Recompensa destacada:** card horizontal con la recompensa más cercana/canjeable: imagen + *"Bolsa Rolito gratis · 1,500 pts"* + `Canjear` o progreso.
  5. Productos frecuentes (chips con foto, tap = +1 al carrito).
  6. Último pedido con estado ("S00123 confirmado · llega mañana por la mañana").
  7. Estado de cuenta SOLO si hay pendiente: banner suave *"Tienes un pago pendiente · Ver detalles"*.
  8. **Botón WhatsApp persistente:** *"Contactar a Grupo Frío"* (→ pantalla 11 o deep link directo al bot con contexto).
- **Estados:** loading = skeleton por card; error parcial por card (si puntos falla, pedidos vive); empty (cliente nuevo) = bienvenida + explicación del programa + CTA primer pedido.
- **Backend:** `/api/account/profile` ✅, `/api/b2b/orders/history` ✅ (agregar `?limit=`), `/api/rewards/summary` 🆕, `/api/rewards/catalog` 🆕 (destacada), facturas ✅.
- **Implementable ya:** estructura completa + repetir pedido + frecuentes; cards de puntos/recompensa en `teaser` hasta que Odoo esté listo.

### 3. Pedido rápido (flujo)

- **Objetivo:** del impulso "necesito hielo" al pedido enviado en <60s.
- **Mecánica:** `Repetir este pedido` → carrito con las líneas del último pedido a **precios y tasas actuales revalidados contra `/api/catalog`** (no los históricos — corrige el bug B2) → stepper +/− → confirmar.
- Producto no disponible → línea "Ya no disponible" con sugerencia, nunca fallo silencioso.
- **Copy:** *"Tu pedido de siempre, listo en un toque."*
- **Backend:** existente. **Implementable ya: 100%. Quick win #2.**

### 4. Catálogo (`/catalog`, mejorado)

- Header: "Catálogo" + buscador; **quitar "Portal Distribuidores · KOLDOS"**; bloque de crédito SOLO si `credit_limit > 0`.
- Sección "Tus frecuentes" arriba.
- Cards: foto (poblar `image_128` en Odoo — tarea de datos), presentación clara ("Bolsa Rolito 5 kg"), precio, +/−, y **"⭐ suma X pts"** cuando rewards esté `live` y las reglas por producto se conozcan (pregunta 6 del cuestionario).
- Estados: ya existen; migrar a skeleton grid.
- **Implementable ya:** todo menos puntos por producto.

### 5. Carrito / Confirmación (`/cart`, retocado)

- Títulos: *"Tu pedido"* / *"Entrega"* / *"Resumen"*; botón `Confirmar pedido`.
- **"Ganarás ⭐ ~X puntos con este pedido"** junto al total — el estimado lo responde el server con la regla de Odoo (la PWA no calcula puntos; si no hay endpoint aún, no se muestra).
- Eliminar bloque muerto de crédito o reactivarlo bien; fecha humana ("Mañana, jueves 5"); dirección con "¿Está mal? Avísanos".
- Validaciones en llano: *"El Rolito 5kg cambió de precio: ahora $XX"*.
- **Implementable ya:** copy/estructura sí; puntos estimados depende de rewards.

### 6. Confirmación (`/order/confirmed`, retocado)

- Conservar estructura + **card dorada "⭐ Este pedido te suma X puntos"** + micro-celebración breve.
- Nota de timing según regla de acumulación: *"Tus puntos se abonan cuando recibas tu pedido"* (ajustar al momento real que confirme Odoo — pregunta 5).
- Estados de pedido en llano: confirmado → *"Tu pedido está confirmado. Te lo lleva tu ruta de siempre."*; draft → *"Recibimos tu pedido. Tu asesor te confirma la entrega en breve."*

### 7. Recompensas / Mis puntos (`/rewards`) — pantalla ESTRATÉGICA, no secundaria

- **Objetivo:** que el tendero entienda el juego en 10 segundos y sienta progreso. Es el diferenciador de Grupo Frío; tab propio en el BottomNav.
- **Estructura:**
  1. Header dorado/hielo: *"Mis puntos Grupo Frío"* + saldo gigante **⭐ 1,240**.
  2. Nivel del cliente (SOLO si el programa Odoo tiene niveles — pregunta 11; no inventar).
  3. **Barra de progreso** hacia la siguiente recompensa alcanzable: *"Te faltan 260 pts para: Bolsa Rolito gratis"*.
  4. *"¿Cómo gano puntos?"*: *"Cada compra con Grupo Frío suma puntos. Acumúlalos y cámbialos por beneficios para tu tienda."* + regla concreta desde Odoo ("$1 = X pts" / "cada bolsa = X pts") + momento de abono + expiración si aplica (*"Tus puntos vencen el DD/MM"* — solo si el programa expira).
  5. **Catálogo de recompensas:** grid con TODAS — disponibles (color, botón `Canjear`) y **bloqueadas** (gris, candado suave, *"Te faltan 460 pts"* + mini barra). Ver lo que casi alcanzas es el motor psicológico del programa.
  6. **Historial de movimientos:** `+120 · Pedido S00123 · 2 jul` / `−1,500 · Canje: Bolsa Rolito · folio R-00045` / `−200 · Puntos vencidos` .
  7. Reglas claras (link "Ver reglas del programa"): acumulación y momento de abono, **máximo 1 canje al mes**, expiración si aplica, cómo se entregan las recompensas (con tu siguiente pedido o como descuento), y qué pasa si se cancela un pedido (los puntos de ese pedido se revierten).
- **CTA principal:** `Canjear` (por recompensa). **Secundario:** `Hacer un pedido para sumar puntos` → catálogo.
- **Estados:** loading = skeleton saldo+grid; empty (0 pts, sin historial) = *"Haz tu primer pedido y empieza a sumar puntos"*; error = *"No pudimos cargar tus puntos. No te preocupes: tus puntos están seguros."* + reintentar; `teaser` = pantalla de lanzamiento próximo con las reglas del programa.
- **Backend:** `GET /api/rewards/summary` + `/catalog` + `/history` (🆕, spec en doc 01 §3.2).
- **Depende de:** respuestas A-E del cuestionario Odoo.

### 8. Canje automático (`/rewards/redeem/[id]`) — flujo completo

- **Objetivo:** canjear en 3 toques con cero ambigüedad y cero riesgo de doble canje.
- **Flujo:**
  1. **Detalle:** imagen + nombre + descripción + **⭐ 1,500 pts** + disponibilidad + *"Te quedarían 240 pts"* → `Canjear ahora`.
  2. **Confirmación (bottom sheet):** *"¿Confirmas tu canje? Vas a usar 1,500 puntos por: Bolsa Rolito 5kg gratis."* → `Sí, canjear` / `Todavía no`. (Doble toque intencional: es la única fricción permitida.)
  3. **Validación automática** — `POST /api/rewards/redeem` con `idempotency_key`; Odoo valida saldo + disponibilidad + bloqueos, **descuenta puntos y registra el canje en una sola transacción** (método atómico, doc 01 pregunta 19).
  4. **Éxito:** check animado breve + **folio `R-00045`** + nuevo saldo + **instrucciones de entrega** según `delivery_mode` (solo dos modos iniciales, DECIDIDO): *"Tu recompensa llega con tu siguiente pedido"* / *"Se aplicará como descuento en tu siguiente pedido/factura"*. (La entrega independiente en ruta queda fuera de la fase inicial.)
  5. El canje aparece en historial como **"Pendiente de entrega"** (producto) o **"Pendiente de aplicarse"** (descuento) hasta que operación lo marque cumplido en Odoo.
- **Estados de error (contrato completo, alineado a las reglas decididas):**
  - **Puntos insuficientes** (el saldo cambió): *"Te faltan X puntos para esta recompensa."* + saldo actualizado.
  - **Recompensa agotada:** *"Esta recompensa se agotó. Mira otras disponibles."* + volver al catálogo.
  - **Límite mensual alcanzado** (`monthly_limit_reached` — máx. 1 canje/mes, validado en Odoo): *"Ya usaste tu canje de este mes. Podrás canjear otra recompensa el próximo mes."* + fecha en que puede volver a canjear si Odoo la devuelve.
  - **Error Odoo/red:** *"No se pudo completar el canje. **No se descontaron puntos.** Intenta de nuevo."* + reintentar (el reintento manda la MISMA idempotency_key → si el canje sí entró, recibe el folio original, no un doble canje).
  - **Replay/duplicado:** transparente — se muestra el folio original como éxito.
  - *(Estado FUTURO, no inicial — decisión Yamil: el bloqueo por saldo vencido está desactivado en el piloto. La UI NO muestra mensajes de bloqueo por pagos; solo si algún día Odoo devuelve explícitamente `customer_blocked`, se mostraría: "Para canjear, primero ponte al corriente con tus pagos." + link a Mis pagos.)*
- **Notificación a operación:** cada canje dispara webhook n8n (patrón idéntico a `N8N_WEBHOOK_ORDERS`) → el ejecutivo lo ve y **ejecuta** la entrega con el siguiente pedido o la aplicación del descuento. El asesor NO aprueba — solo entrega/aplica.
- **Backend:** `POST /api/rewards/redeem` 🆕 + método atómico en Odoo (Sebas) + webhook n8n.
- **Depende de:** las reglas de negocio ya están DECIDIDAS (sin bloqueo por vencidos en piloto, 1 canje/mes, reversa sí, dos modos de entrega); queda la implementación técnica de Sebas: preguntas 14, 16 (mecánica de reversa), 17 y **19 (método atómico)**. **Sin método atómico no se lanza** (fase intermedia admisible en doc 01 §3.4).

### 9. Estado de cuenta (`/account/invoices` → "Mis pagos", tono suavizado)

- Al corriente → protagonismo al positivo: ✅ *"Estás al corriente. ¡Gracias por comprar con Grupo Frío!"*.
- Deuda → *"Pagos pendientes"* (no "Deuda Total"); vencidas → *"Tienes un pago vencido. Ponte al corriente para no detener tus entregas."*
- **Modal SPEI solo si `NEXT_PUBLIC_BANK_CLABE` real existe** (eliminar fallbacks falsos).
- Agregar estado de error real (hoy un fallo de red parece "al corriente").
- Mantener Ver PDF y Enviar comprobante por WA.
- **Implementable ya: 100%.**

### 10. Soporte / Ayuda (`/support`) — NUEVA, con el bot integrado

- **Objetivo:** un solo lugar de ayuda; el cliente no debe decidir entre "app o bot" — la app lo lleva al canal correcto.
- **Estructura:**
  1. **Card principal — Asistente Grupo Frío (bot 55 4000 0990):** *"Escríbenos por WhatsApp. Te atendemos al momento."* + botones por tema que abren el bot con **mensaje pre-llenado e identificado**:
     - *"Hola, soy {tienda} del Portal Grupo Frío. Necesito ayuda con mi pedido {folio}."*
     - *"…con mis puntos."* / *"…con una recompensa (folio {R-xxx})."* / *"…con un pago."*
     El contexto viaja en el texto del mensaje (deep link `wa.me/<bot>?text=...`); n8n identifica al cliente por su teléfono, como ya hace en auth.
  2. **Card asesor humano:** nombre real (de `partner.user_id`), *"Tu asesor Grupo Frío"* + `WhatsApp` (teléfono real, ya resuelto por el endpoint) + `Llamar`.
  3. Otras opciones: *Reportar un problema con mi entrega* · *Corregir mis datos* · *Preguntar por recompensas*.
  4. Horario de atención humana; el bot 24/7.
- **Estados:** sin ejecutivo asignado → solo bot + número general (`NEXT_PUBLIC_WA_SALES`), sin mostrar "no asignado".
- **Backend:** existente (`/api/account/profile`) + `NEXT_PUBLIC_WA_BOT` 🆕 (hoy hardcodeado en la portada).
- **Implementable ya: 100%.**

### 11. Perfil (`/account`, reorganizado)

- Header avatar + nombre comercial + teléfono → **card crédito SOLO si `credit_limit > 0`** (corrige "$0.00" y crash B1) → datos: dirección de entrega, RFC, plaza/ruta ("Tu plaza: Guadalajara", de `x_analytic_un_id`), asesor → menú: Mis pedidos · Mis pagos · Mis puntos · Ayuda → Cerrar sesión → versión de la app.
- Error con reintentar (corrige crash B1).
- **Implementable ya: 100%** (exponer plaza en `/api/account/profile`, 1 campo).

### 12. Historial (`/account/orders`, retocado)

- "Mis pedidos"; `Repetir pedido` como acción primaria de cada card (con revalidación de precios — fix B2); estado con lenguaje llano; estado de error real.
- **Implementable ya: 100%.**

---

## Prioridad de pantallas (v2 — recompensas sube a P0 de diseño)

| Prioridad | Pantalla | Nota |
|-----------|----------|------|
| P0 | Portada con promesa completa + rebranding global | La cara del producto; promete recompensas desde día 1 |
| P0 | Home (3 protagonistas) con cards de puntos en teaser-ready | Se lanza aunque rewards llegue después |
| P0 | Fixes de confianza (crash /account, IVA reorden, CLABE falsa) | Tocan dinero/confianza |
| P0-P1 | Rewards + canje automático | El diferenciador; el frontend se diseña YA, el `live` depende de Odoo (Sebas) |
| P1 | Ayuda con bot integrado | Barato y cierra el "un solo servicio" |
| P2 | Pulido enterprise: skeletons, micro-animaciones, fotos de producto, accesibilidad | PR-7 del plan |
