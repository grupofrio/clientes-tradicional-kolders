# Entregable 5 (doc nuevo) — Arquitectura producto-servicio: PWA + Odoo + n8n + Bot WhatsApp + Vercel

**Objetivo:** que el cliente perciba **UN solo servicio digital de Grupo Frío**, sin importar si entra por la app o por WhatsApp — y que técnicamente eso sea verdad: una sola fuente de reglas y datos.

---

## 1. Principio rector: cada pieza tiene UN rol

```
                         ┌──────────────────────────────┐
                         │   ODOO 18 (fuente de verdad) │
                         │  clientes · productos ·      │
                         │  precios · pedidos · crédito │
                         │  facturas · PUNTOS · CANJES  │
                         │  + métodos atómicos de       │
                         │    negocio (crear pedido,    │
                         │    gf_loyalty_redeem)        │
                         └──────────┬───────────────────┘
                       JSON-RPC ▲   │   ▲ RPC/API
                                │   │   │
        ┌───────────────────────┴─┐ │ ┌─┴──────────────────────────┐
        │ PWA (Vercel/Next.js)    │ │ │ n8n (n8n.grupofrio.mx)     │
        │ = experiencia VISUAL    │ │ │ = orquestador              │
        │ route handlers delgados │ │ │   CONVERSACIONAL           │
        │ (adaptan Odoo→UI,       │ │ │ auth WhatsApp (W15),       │
        │  0 reglas de negocio)   │ │ │ bot de servicio, intents,  │
        └───────────┬─────────────┘ │ │ notificaciones a operación │
                    │               │ └─────────────┬──────────────┘
             cliente en la app      │         cliente en WhatsApp
                    │               │               │
                    ▼               │               ▼
              📱 TENDERO ◄──────────┴──────► 💬 BOT 55 4000 0990
                    ▲    deep links / magic links   ▲
                    └───────────────────────────────┘
                        misma identidad: partner_id
                                                    👤 ASESOR/OPERACIÓN
                                            (Odoo backend + avisos WA vía n8n)
```

| Pieza | Rol | Qué NUNCA hace |
|-------|-----|----------------|
| **Odoo** | Fuente de verdad y **dueño de todas las reglas de negocio**: precios, crédito, stock, acumulación de puntos, validación y ejecución de canjes | Ser UI del cliente |
| **PWA (Vercel)** | Experiencia visual del cliente. Sus API routes son **adaptadores delgados** (sesión + ownership + formato), no lógica | Calcular puntos, precios o IVA; guardar saldos; decidir si un canje procede |
| **n8n** | Orquestador conversacional: identidad por teléfono (ya lo hace en W15), intents del bot, magic links, notificaciones a ejecutivo/operación | Guardar saldos/puntos propios; duplicar reglas de Odoo; ser almacén de estado de negocio |
| **Bot WhatsApp (55 4000 0990)** | Canal de servicio 24/7 y puerta de entrada (magic links). Mismo `partner_id`, mismos datos | Tener "su propia" versión de puntos o estado de pedidos |
| **Vercel** | Hosting/CD del frontend (previews por PR, prod desde main) | Contener secretos de negocio más allá de env vars del adaptador |
| **grupofrio.mx (Odoo Website)** | Marca institucional y canal B2C (KoldHome) | Confundirse con el portal B2B — enlazar al portal, no duplicarlo |
| **Asesor/operación** | Capa humana: atiende escalamientos, **entrega** recompensas (no las aprueba), gestiona excepciones desde Odoo | Aprobar canjes manualmente (decisión v2: canje automático) |

**Las dos reglas anti-divergencia:**
1. **Ninguna regla de negocio se implementa dos veces.** Si la PWA y el bot necesitan la misma respuesta (¿cuántos puntos tengo? ¿procede este canje?), ambos llaman a Odoo — idealmente al MISMO método. El precedente negativo ya existe en el repo (catálogo calcula IVA real, `orders/create` asume 16% en un check): eso es exactamente lo que no puede pasar con puntos.
2. **n8n no debe llamar a los `/api/*` de la PWA.** Esos endpoints dependen de cookies de sesión del navegador y del deploy de Vercel. El bot habla con Odoo directamente (como ya hace para auth y catálogo de otros bots). La "capa de servicios común" es Odoo, no un middleware nuevo.

---

## 2. Identidad unificada (ya existe, hay que cuidarla)

- n8n resuelve **teléfono → partner_id** (W15) — es el registro civil del ecosistema.
- La PWA obtiene el mismo `partner_id` vía el magic link verificado contra n8n y lo guarda en su JWT.
- El bot conoce al cliente por su número de WhatsApp → mismo partner.

**Consecuencia:** puntos, pedidos y facturas son idénticos por ambos canales *por construcción*, siempre que ambos lean de Odoo. No hay que sincronizar nada: hay que **no crear** estados paralelos.

## 3. Flujos clave, canal por canal

### 3.1 Magic link desde WhatsApp (existe — formalizar)
1. Cliente escribe al bot ("Dame mi acceso" — el CTA de la portada ya pre-llena esto).
2. n8n identifica el teléfono → genera token efímero → responde el link `…/login?token&phone`.
3. PWA valida contra n8n (`pwa-auth-verify`) → sesión 7 días.
- **Endurecer:** TTL corto y un-solo-uso del token en W15 (verificar configuración actual); la PWA limpia el token de la URL tras validar (`history.replaceState`).
- **Intent recomendado:** cualquier mensaje tipo "portal/app/entrar/mi cuenta" → el bot responde el magic link. El bot es el "reset de contraseña" del ecosistema: sin contraseñas que olvidar.

### 3.2 Consulta de pedidos por WhatsApp
- Intent "¿cómo va mi pedido?" → n8n consulta Odoo (`sale.order` por partner, mismo filtro de canal que usa la PWA) → responde estado en lenguaje llano + link profundo a `/account/orders`.
- Regla: los estados y textos deben mapear igual que en la PWA (definir una tabla única estado→texto, documentada, usada por ambos).

### 3.3 Consulta de puntos por WhatsApp
- Intent "¿cuántos puntos tengo?" → n8n lee de Odoo lo MISMO que `/api/rewards/summary` (la `loyalty.card` del partner) → *"Tienes ⭐ 1,240 puntos. Te faltan 260 para tu Bolsa Rolito gratis 🧊. Míralo aquí: {link a /rewards}"*.
- El link profundo lleva a la PWA — el bot informa y engancha, la PWA convierte.

### 3.4 Canje
- **Fase 1 (lanzamiento):** el canje se ejecuta en la PWA (`POST /api/rewards/redeem` → método atómico Odoo). El bot **informa** saldo y recompensas y **linkea** a `/rewards`; si el cliente insiste en canjear por chat, el bot manda el link directo a la recompensa.
- **Fase 2 (tras medir):** el bot puede iniciar canjes llamando **el mismo** `gf_loyalty_redeem` (misma idempotencia, mismo folio), con confirmación conversacional estricta (resumen + "responde SÍ CANJEAR") para blindar contra malentendidos del LLM. Como ambos canales usan el mismo método, no puede haber doble contabilidad.

### 3.5 Soporte desde la PWA hacia WhatsApp
- Botones de ayuda en la PWA → deep link `wa.me/<bot>?text=` con **mensaje pre-llenado e identificado**: *"Hola, soy {tienda} del Portal Grupo Frío. Necesito ayuda con {mi pedido S00123 / mis puntos / mi recompensa R-00045 / un pago}."*
- n8n reconoce el prefijo → enruta el intent directo (sin re-preguntar) y tiene el folio en el texto. De paso, el prefijo hace **medible** cuánto soporte origina la PWA.
- Escalamiento a humano: el patrón de handover a asesor ya existe en los bots GF (W06) — reutilizarlo.

### 3.6 Notificaciones a operación
- Pedido nuevo → webhook n8n → aviso al ejecutivo (existe: `N8N_WEBHOOK_ORDERS`).
- **Canje nuevo → mismo patrón** (`N8N_WEBHOOK_REWARDS` o reutilizar el de orders con `tipo: canje_recompensa`): el ejecutivo/ruta recibe folio, cliente, recompensa y modo de entrega. Operación **ejecuta** la entrega y la marca en Odoo; no aprueba.

## 4. El contrato de canje automático (la pieza técnica central)

**Una sola transacción en Odoo** (método modelo, p.ej. `loyalty.card.gf_redeem(partner_id, reward_id, idempotency_key, channel)`), implementando las reglas de negocio YA decididas por Yamil (README):
1. Valida: card del partner en el programa B2B, saldo ≥ costo, recompensa activa/con stock, **límite mensual no excedido (máx. 1 canje/mes — DECIDIDO; se valida AQUÍ, nunca en frontend)**, key no usada. *(El bloqueo por saldo vencido NO se valida en fase inicial — decisión de negocio; el método debe dejar el hook listo para activarlo después sin cambiar el contrato.)*
2. Descuenta puntos + crea el registro de canje con **folio**, su **`delivery_mode`** (`next_order` = producto gratis con el siguiente pedido | `discount_next_invoice` = descuento en siguiente factura/pedido — únicos dos modos iniciales) y estado `pendiente_entrega` / `pendiente_aplicacion`.
3. Devuelve `{folio, points_spent, new_balance, delivery_mode}` — o el error tipado: `insufficient_points` | `reward_unavailable` | `monthly_limit_reached`.
4. Unique constraint sobre la key → un reintento devuelve el canje original (replay), nunca duplica. (Patrón ya probado en este ecosistema con `x_kold_idempotency_key` en `sale.order`.)
5. **Reversa (DECIDIDO: existe):** si se cancela un pedido que generó puntos, Odoo revierte esos puntos. Mitigación estructural: abonar al entregar/facturar, no al crear. La mecánica del caso "puntos ya gastados en un canje" (saldo negativo controlado / ajuste pendiente / bloquear canjes hasta compensar) **la propone Sebastián** — es parte del mismo dominio Odoo, jamás de la PWA ni de n8n.
6. **Estado de entrega/aplicación vive en Odoo:** operación marca el canje como entregado/aplicado ahí; PWA y bot solo lo leen.

**Quién lo construye:** Sebastián (territorio Odoo). **Quién lo consume:** PWA (PR 5) y después el bot (fase 2). La PWA/n8n jamás hacen `write` directo sobre `loyalty.card.points`.

**Por qué así:** cualquier alternativa donde el cliente (PWA o n8n) lea el saldo y luego escriba el descuento en llamadas separadas tiene condición de carrera (doble canje con doble tap o dos dispositivos) y reparte la regla de negocio en dos lugares.

## 5. Qué vive dónde — tabla de decisión rápida

| Cosa | Odoo | n8n | PWA |
|------|:----:|:---:|:---:|
| Saldo de puntos, reglas de acumulación, catálogo de recompensas | ✅ dueño | lee | lee |
| Validación y ejecución de canje (folio) | ✅ dueño | llama (fase 2) | llama |
| **Límite 1 canje/mes · reversa de puntos · `delivery_mode` · folio · estado de entrega/aplicación** | ✅ dueño (dentro del método atómico) | solo notifica | solo muestra |
| Precios/pricelists/IVA/crédito/stock | ✅ dueño | lee | lee |
| Identidad teléfono→partner, tokens de acceso | — | ✅ dueño | consume |
| Conversación, intents, copy del bot, handover a humano | — | ✅ dueño | deep-linkea |
| Notificaciones a ejecutivo/operación | dispara eventos | ✅ entrega | dispara webhook |
| UI, navegación, estados visuales, sesión del navegador | — | — | ✅ dueño |
| Textos estado-de-pedido (tabla única estado→texto) | definición | usa | usa |

## 6. Riesgos de esta arquitectura y cómo se vigilan

| Riesgo | Vigilancia |
|--------|-----------|
| Divergencia PWA vs bot (reglas copiadas) | Regla escrita "toda regla vive en Odoo" + test de consistencia periódico: mismo partner de prueba → comparar respuesta de `/api/rewards/summary` vs respuesta del bot |
| n8n como cuello de botella del auth | Ya es así hoy (W15); monitorear y documentar el workflow como crítico. Fallback: el bot re-emite magic link al instante |
| Canje automático mal parametrizado | Piloto con recompensas de bajo costo + límite de canjes/periodo + reporte diario de canjes las primeras semanas |
| Doble contabilidad si el bot canjea "a su manera" | Prohibido: el bot solo puede canjear vía el mismo método atómico (fase 2) |
| Preview de Vercel apuntando a Odoo productivo | Guardrail de QA (doc 04): partner de prueba dedicado, nunca canjes/pedidos reales de prueba sin coordinación |
| Cliente confundido entre asesor humano y bot | La pantalla Ayuda presenta ambos con roles claros: bot = al momento, asesor = tu persona de confianza |

## 7. Dependencias externas al repo PWA (para coordinar)

1. **Odoo (Sebastián):** ampliar programa loyalty a B2B (cuestionario doc 01 §3.1) + método atómico de canje + permisos del usuario de servicio + (dato) fotos `image_128` de productos.
2. **n8n (Claude/Yamil):** intents nuevos del bot (portal/pedidos/puntos), reconocimiento del prefijo identificado, webhook de canjes a operación, verificación TTL/un-solo-uso del token W15. n8n productivo es fuente de verdad — cambios con snapshot previo y S/N, como siempre.
3. **Operación:** los modos de entrega ya están DECIDIDOS (con el siguiente pedido / descuento en siguiente factura-pedido; entrega independiente en ruta queda fuera de fase inicial). Falta solo definir el procedimiento operativo: quién agrega la línea/descuento al siguiente pedido y quién marca "entregado/aplicado" en Odoo.
