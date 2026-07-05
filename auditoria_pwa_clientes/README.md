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
