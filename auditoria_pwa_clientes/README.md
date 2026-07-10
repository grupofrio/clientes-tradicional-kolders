# Auditoría y Rediseño — Plataforma Digital de Clientes Grupo Frío (PWA Canal Tradicional)

**Fecha:** 2026-07-04 (v2 — corrección estratégica del mismo día)
**Repo auditado:** `grupofrio/clientes-tradicional-kolders` (rama `main`, commit `0df926c`, 55 commits)
**Producción:** https://clientes-tradicional-gf.vercel.app (verificado: corre exactamente el HEAD de `main`)
**Estado:** SOLO DIAGNÓSTICO Y PROPUESTA — esta rama contiene únicamente documentación. Cero cambios de código funcional, cero merge a main, cero deploy.

## Decisiones de producto confirmadas por Yamil (v2, 2026-07-04)

Estas decisiones **sustituyen** lo que decía el `AUDIT_REPORT.md` del MVP de abril:

1. **Recompensas SÍ va para B2B/canal tradicional.** La exclusión "lealtad es solo B2C" queda obsoleta. El programa se ampliará en Odoo para clientes B2B.
2. **La portada promete recompensas desde el día 1** (opción B): *"Haz tus pedidos, gana puntos y canjea recompensas con Grupo Frío."*
3. **El canje objetivo es AUTOMÁTICO** (validación de saldo, descuento de puntos y registro del canje en Odoo sin aprobación manual del asesor). Se admite fase técnica intermedia, pero la arquitectura apunta a canje automático.
4. **El bot de servicio (55 4000 0990, n8n) es parte de la misma experiencia**, no una herramienta separada. El cliente debe percibir UN solo servicio digital de Grupo Frío.
5. **Ambición de diseño:** herramienta B2B de primer mundo — institucional + moderna + gamificación ligera; benchmark potencial en la industria de congelados para canal tradicional.

## Reglas de negocio de recompensas confirmadas por Yamil (2026-07-04)

Las 4 reglas de canje que estaban pendientes ya tienen decisión final:

1. **Bloqueo por saldo vencido: NO en fase inicial.** La mayoría del canal tradicional es de contado; no se mete fricción financiera al piloto. `customer_blocked` por vencidos queda **desactivado**; la arquitectura debe permitir activarlo después si Grupo Frío lo decide; la UI no muestra mensajes de bloqueo por pagos vencidos salvo que Odoo devuelva explícitamente una regla futura.
2. **Límite de canjes: máximo 1 canje al mes por cliente.** Se valida **en Odoo, dentro del método atómico** (nunca en frontend). Si ya canjeó ese mes, el endpoint responde error claro (`monthly_limit_reached`). Copy: *"Ya usaste tu canje de este mes. Podrás canjear otra recompensa el próximo mes."*
3. **Reversa de puntos: SÍ existe.** Si se cancela el pedido que generó puntos, los puntos se revierten. Recomendación técnica: abonar puntos al **entregar/facturar/confirmar cumplimiento** (no al crear el pedido) para minimizar reversas. Si los puntos ya se usaron en un canje antes de la cancelación, el comportamiento seguro (saldo negativo controlado / ajuste pendiente / bloquear siguientes canjes hasta compensar) **lo propone Sebastián en Odoo**.
4. **Modos de entrega iniciales: solo dos** — (a) recompensa física/producto gratis: **con el siguiente pedido**; (b) recompensa tipo descuento: **en la siguiente factura/pedido**. La entrega independiente en ruta queda FUERA de la fase inicial. **Cada recompensa define su propio `delivery_mode` — el cliente NO elige el modo de entrega.** El folio devuelve instrucciones claras; operación/asesor **ejecuta** la entrega o aplicación, no aprueba el canje.
5. **Momento de acumulación de puntos:** los puntos se ganan **al pagar/cumplir la condición comercial, no al crear el pedido**. Cliente de contado → puntos al momento de **entrega/cobro**; cliente de crédito → puntos al momento del **pago**. Esto reduce estructuralmente las reversas por pedidos cancelados o no pagados.
6. **Base de cálculo de puntos: el total pagado.** Nota de negocio: los productos de Grupo Frío tienen **IVA 0%**, por lo que el total con IVA coincide con el total real de Odoo. Regla técnica: **la PWA no asume IVA 0 ni IVA 16 — usa siempre el total real de Odoo**; el hardcode `subtotal * 1.16` de `orders/create` debe eliminarse (entra en PR 1).
7. **Presupuesto/stock de recompensas: hoy NO existe presupuesto formal.** No bloquea PR 1, PR 2 ni PR 3. **SÍ bloquea el canje en vivo**: no se activa `redeem` live sin un **catálogo piloto de recompensas autorizado por operación/comercial/finanzas**. Recomendación: iniciar con recompensas de bajo costo, controladas por Odoo, protegidas por el límite de 1 canje/mes.
8. **Promesa en portada (PR 2):** sí se promete recompensas desde el día 1, pero mientras Odoo no esté live, SOLO como teaser — sin puntos numéricos, sin saldos falsos, sin recompensas "canjeables" falsas.

## Auditoría Codex (2026-07-04, contra docs + código real de `main` @ `0df926c`)

Codex **confirmó** lo esencial: la PWA no tiene recompensas; Odoo debe ser fuente de verdad; la PWA no calcula ni descuenta puntos; el canje automático requiere método atómico en Odoo; el orden PR1→PR5 es razonable. **Correcciones incorporadas en esta v3:**
- PR #10 sigue en draft; no se mergea aún.
- PR 1 se acota a estabilidad/confianza únicamente (lista final archivo por archivo en doc 04).
- PR 2 **no** apunta `start_url`/redirects a `/home` mientras `/home` no exista (o crea una ruta mínima estable).
- Vercel Preview no debe poder crear pedidos/canjes reales contra Odoo productivo salvo **allowlist explícita**; sin allowlist, en preview solo se prueba hasta el carrito.
- Guardrails mínimos para mutaciones con cookie antes de sumar rewards: rate limit, Origin/Referer guard, CSRF o equivalente, preview mutation guard.
- Naming honesto: **solo se llama "canje automático" si existe el método atómico en Odoo; sin él, se llama "solicitud de canje"**.
- Precisión del bug de `orders/create`: las líneas SÍ mandan impuestos reales a Odoo; lo incorrecto es `total_con_iva = subtotal * 1.16` usado para el check de crédito y la respuesta — debe sustituirse por el total real de Odoo.

## Documentos

| Doc | Contenido |
|-----|-----------|
| [01_auditoria_tecnica.md](01_auditoria_tecnica.md) | Mapa del proyecto, funcionalidad existente, recompensas B2B (validaciones Odoo + spec de endpoints), sección PWA+Bot, riesgos |
| [02_diagnostico_ux.md](02_diagnostico_ux.md) | Diagnóstico UX/UI: ¿la app convence a un tendero de que gana algo? |
| [03_rediseno_pantallas.md](03_rediseno_pantallas.md) | Rediseño con recompensas como eje central: 12 pantallas, canje automático, sistema visual, copy |
| [04_plan_implementacion_y_mvp.md](04_plan_implementacion_y_mvp.md) | Plan por PRs (PR0–PR7) con recompensas como parte central + MVP |
| [05_arquitectura_pwa_odoo_n8n_rewards.md](05_arquitectura_pwa_odoo_n8n_rewards.md) | **NUEVO** — Arquitectura producto-servicio: PWA + Odoo + n8n + bot WhatsApp + Vercel + asesor |

## Hallazgo técnico central (sin cambios en v2)

**En la PWA no existe ni una línea de código de recompensas** — ni en el working tree ni en los 55 commits del historial. No es un módulo oculto ni un flag apagado: nunca se construyó, porque el MVP de abril lo excluyó a propósito. **Esa exclusión queda revertida por decisión de producto (v2).** Hay que construir el frente completo (endpoints + pantallas + navegación) y ampliar el programa en Odoo para B2B. El detalle de qué validar en Odoo y qué endpoints crear está en el doc 01; la arquitectura integral en el doc 05.
