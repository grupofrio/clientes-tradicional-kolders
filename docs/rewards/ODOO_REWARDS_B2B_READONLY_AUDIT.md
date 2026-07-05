# Auditoría READ-ONLY — Loyalty/Rewards en Odoo para Recompensas B2B

**Fecha:** 2026-07-05
**Instancia:** `grupofrio.odoo.com` (base de datos productiva — identificador omitido del repo, Odoo 18)
**Usuario/método:** usuario de dirección (login omitido del repo) vía JSON-RPC. **Operaciones usadas: `authenticate`, `search_read`, `read`, `search_count`, `fields_get` — exclusivamente lectura.** Cero writes, cero creates, cero cambios de permisos, cero módulos instalados, cero automatizaciones activadas, cero canjes. El guard del script bloqueaba cualquier método no-lectura.
**Nota metodológica:** los permisos reportados son del usuario dirección (amplios). **El usuario RPC de servicio de la PWA es otro** (vive en el env de Vercel) — sus permisos sobre modelos loyalty quedan como verificación pendiente (Sebas).

> **CORRECCIÓN 2026-07-05 (tras leer el código fuente del módulo, ver doc 07 §0):** `gf_w14_loyalty_engine` NO calcula puntos en Odoo — es un emisor de webhooks hacia n8n (post-entrega + cron), y el "loyalty" B2C que alimenta es el sistema de streaks/niveles de `gf_partner_loyalty`, no `loyalty.card`. El riesgo "el cron expira puntos B2B" baja de crítico a **verificación pendiente en n8n** (leer el workflow `loyalty-expiry-check` antes de crear cards). **CRITERIO FINAL (v3, Codex + Sebastián): W14 NO se extiende ni se reutiliza su disparo** — el evento elegible para acumular B2B no es la entrega sino el COBRO CONFIRMADO (`account.payment` GF + recepción de efectivo de ruta sin discrepancia); W14 queda solo como referencia de evento operativo y como aislamiento a validar (P6). El plan técnico vigente es el doc 07 v3.

---

## A. Módulos y modelos loyalty

### Módulos instalados (los 4 nativos completos)

| Módulo | Estado |
|--------|--------|
| `loyalty` | ✅ installed |
| `sale_loyalty` | ✅ installed |
| `pos_loyalty` | ✅ installed |
| `website_sale_loyalty` | ✅ installed |

### Modelos existentes y legibles

| Modelo | Qué es | Estado |
|--------|--------|--------|
| `loyalty.program` (39 campos) | Programa | ✅ legible; campos clave: `program_type`, `trigger`, `applies_on`, `company_id`, `portal_visible`, `sale_ok/pos_ok/ecommerce_ok`, `rule_ids`, `reward_ids`, `limit_usage/max_usage`, `date_from/to` |
| `loyalty.card` (20 campos) | Saldo por cliente | ✅ legible; `partner_id`, `program_id`, `points`, `code`, `expiration_date` |
| `loyalty.reward` (32 campos) | Recompensa | ✅ legible; `reward_type` (product/discount), `required_points`, `discount_mode`, `reward_product_id`, `reward_product_qty` |
| `loyalty.rule` (25 campos) | Regla de acumulación | ✅ legible; `reward_point_amount`, `reward_point_mode` (money/order/unit), `minimum_amount`, `product_domain/ids` |
| `loyalty.history` (9 campos) | **Historial de movimientos** | ✅ el modelo EXISTE y es legible; `card_id`, `description`, `issued`, `used`, `order_model`, `order_id` — justo lo que `/api/rewards/history` necesita |
| **`gf.loyalty.cron.service`** | CUSTOM (ver abajo) | ✅ existe |

### Customizaciones GF existentes (hallazgo importante)

| Módulo custom | Qué contiene | Relevancia B2B |
|---------------|--------------|----------------|
| **`gf_w14_loyalty_engine`** ("GF W14 Loyalty Engine") | `gf.loyalty.cron.service` (cron **activo diario** "W14: Loyalty Expiry Check", próxima corrida 2026-07-06) + `gf.w14.mixin` + **extensión de `stock.picking`** | **Es el "módulo listo" del que hablaba el brief** — motor de lealtad construido para B2C KoldHome (W14 = workflow n8n B2C). La mecánica clave: engancha la acumulación a `stock.picking` (**entrega**) y expira puntos por cron. **Criterio final: NO se extiende** — es referencia de que el ecosistema reacciona a eventos operativos, pero la señal B2B es el cobro confirmado (no la entrega) y el módulo B2B es hermano separado (doc 07 v3 §0 y §5-bis) |
| `gf_partner_loyalty` ("GF Partner Loyalty & CSAT") | Campos analíticos en `res.partner`: `x_loyalty_level`, `x_loyalty_streak`, `x_csat_score`, `x_last_order_week` | Es scoring/analítica (KoldScore), NO puntos transaccionales. Útil para "nivel del cliente" en la UI si se quiere, pero no es el saldo |

## B. Programas existentes

**Un solo programa en toda la instancia** (incluyendo archivados):

| Campo | Valor |
|-------|-------|
| Nombre | "Gift Cards" (id 1) |
| Tipo | `gift_card` (el default de fábrica de Odoo) |
| Compañía | **1 — CSC GF** (no Glaciem) |
| Regla | 1 pt por $1 sobre el producto "Gift Card" (id 6) |
| Recompensa | descuento `per_point` |
| Uso real | `coupon_count = 0` — **jamás usado** |

**Conclusión B:** no existe ningún programa de recompensas real — ni B2C ni B2B. El "Gift Cards" es el seed de fábrica, de otra compañía, sin uso. **No hay nada reutilizable como programa; hay que CREAR el programa B2B** (compañía 34 Glaciem). `loyalty.card` total: **0**. `loyalty.history` total: **0**. Nadie está acumulando nada hoy.

## C. Cliente de prueba y pedidos PWA

**Partner:** `54907 — YAMIL TRADICIONAL` (tel +523342074269) · `company_type=company` (B2B ✔) · compañía **34 SOLUCIONES EN PRODUCCION GLACIEM** · pricelist por partner "Predeterminado (MXN)" · `credit_limit = 0` (contado ✔) · asesor `user_id=7 ADMINISTRACION GRUPO FRIO` · plaza `[GDL] Guadalajara`.

**Pedidos PWA (últimos 5):** S20690 (draft), S20683 (draft), S17242/41/40 (cancel) — todos con `x_kold_order_source='pwa_b2b'` y `x_studio_canal_origen='pwa_canal_tradicional'` ✔. Detalle del más reciente (S20690): `amount_untaxed=350.00, amount_tax=0.00, amount_total=350.00` (**IVA 0% confirmado en la práctica** — regla 10 validada), `payment_method='cash'`, `x_payment_status='pending'`, pricelist de orden "DELI GUADALAJARA", warehouse CEDIS Guadalajara, idempotency key presente.

**¿Los pedidos PWA podrían disparar loyalty nativo?** Son `sale.order` 100% normales, y `sale.order` YA tiene los campos de integración nativa (`coupon_point_ids`, `reward_amount`, `loyalty_data`, `applied_coupon_ids`) porque `sale_loyalty` está instalado. **PERO** dos razones hacen que la acumulación nativa NO ocurra sola: (1) el cómputo nativo de puntos se dispara en los flujos de UI/website (`_update_programs`), no en `create` por RPC — los pedidos PWA nacen draft por RPC y nada los procesa por esos flujos; (2) **la regla de negocio decidida no es la nativa**: los puntos se ganan al cobro confirmado (contado) o al pago (crédito), no al confirmar orden ni por sola entrega. O sea: aunque el nativo "funcionara", acumularía en el momento equivocado. La acumulación B2B requiere lógica custom — y por criterio final v3, disparada por **COBRO CONFIRMADO** (no por entrega: picking done es solo precondición; ver doc 07 v3 §5-bis).

## D. Permisos del usuario RPC

Con el usuario de dirección: **lectura OK en los 7 modelos probados** (`loyalty.program`, `loyalty.card`, `loyalty.reward`, `loyalty.rule`, `loyalty.history`, `sale.order`, `res.partner`). Sin errores de acceso.
**Pendiente (Sebas):** repetir el mismo test con el **usuario de servicio real de la PWA** (`ODOO_SERVICE_USER` del env de Vercel) — es ese usuario el que consumirá `/api/rewards/*`.

## E. Gap técnico para Sebastián (las 11 respuestas)

1. **¿Loyalty nativo instalado?** Sí, los 4 módulos (loyalty, sale_loyalty, pos_loyalty, website_sale_loyalty).
2. **¿Programas configurados?** Solo el seed "Gift Cards" (compañía 1, jamás usado). **No hay programa B2B: hay que crearlo** (compañía 34, `program_type` loyalty, reglas por total pagado).
3. **¿Cards/saldos?** 0 cards. Nadie acumula hoy.
4. **¿Historial legible?** El modelo `loyalty.history` existe, es legible y tiene los campos ideales para `/api/rewards/history` (`issued`, `used`, `description`, `order_id`). 0 registros hoy.
5. **¿Pedidos PWA compatibles?** Como datos, totalmente (sale.order normales con campos loyalty). Como disparador, NO automáticamente: RPC-create no ejecuta el flujo nativo, y la regla de negocio (acumular al **cobro confirmado** / pago, NO al confirmar orden ni solo por entrega) requiere trigger custom de todos modos.
6. **¿Permisos del RPC?** Dirección lee todo; **falta validar el usuario de servicio de la PWA** (tarea de 5 min para Sebas con el mismo checklist).
7. **¿Customizaciones existentes?** Sí: `gf_w14_loyalty_engine` (motor B2C: acumulación vía stock.picking + cron de expiración ACTIVO) y `gf_partner_loyalty` (scoring analítico). **Criterio final: W14 NO se extiende — solo referencia y aislamiento a validar (doc 07 v3).**
8. **¿Modelos para summary/catalog/history?** `loyalty.card` (saldo por partner+programa) / `loyalty.reward` del programa B2B (catálogo, con `reward_type` mapeando a `delivery_mode`: product→`next_order`, discount→`discount_next_invoice`) / `loyalty.history` (movimientos). Todo nativo — la PWA no necesita modelos nuevos para leer.
9. **¿Qué construye Sebas?** (a) Programa B2B en compañía 34 con reglas (pts por $ pagado); (b) **acumulación custom** disparada por COBRO CONFIRMADO (contado: `account.payment` GF + recepción de efectivo sin discrepancia; picking done solo precondición) y pago conciliado (crédito, fuera del MVP), escribiendo en el libro `gf.rewards.*` + `loyalty.history`; (c) **reversa** si el pedido origen se cancela (política del caso "puntos ya gastados": propone Sebas); (d) **método atómico `gf_loyalty_redeem(partner_id, reward_id, idempotency_key, channel)`** con el límite 1 canje/mes DENTRO de la transacción, folio, `delivery_mode` y estado pendiente_entrega/aplicación; (e) permisos read para el usuario de servicio PWA sobre los 4 modelos loyalty + el método redeem.
10. **¿Es necesario `gf_loyalty_redeem` custom?** **Sí, imprescindible.** El canje nativo de Odoo aplica recompensas dentro del flujo de una orden en UI/website; no existe un método RPC atómico que valide saldo+límite mensual+disponibilidad, descuente y devuelva folio en una transacción. Sin él, la PWA tendría que hacer read-then-write (condición de carrera = doble canje).
11. **¿Riesgos para canje automático?** (i) doble canje sin método atómico (cubierto si se construye con unique constraint de idempotency — patrón ya probado en `sale.order.x_kold_idempotency_key`); (ii) **el cron de expiración W14 corre diario pero solo hace POST a n8n (no toca `loyalty.card` en Odoo)** — el riesgo real vive en el workflow n8n `loyalty-expiry-check` (P6, verificar antes de crear cards); la expiración B2B usa cron propio que nace inactivo; (iii) programa en compañía correcta (34) — el multi-company ya mordió antes (pricelists/taxes); (iv) acumulación sobre **total pagado** con pagos parciales de crédito: definir si acumula proporcional o al liquidar; (v) sin catálogo piloto autorizado no se activa live (gate ya decidido).

## Decisiones de negocio Yamil (2026-07-05 — CONFIRMADAS, sustituyen las preguntas abiertas)

1. **Alcance:** programa B2B para canal tradicional. **Piloto enfocado en clientes de contado**; arquitectura preparada desde el día 1 para clientes de crédito (acumulando solo al pago).
2. **Momento de acumulación:** contado → al **cobro confirmado** (`account.payment` GF + recepción de efectivo de ruta sin discrepancia); crédito → al **pagar**. **Nunca al crear pedido, nunca solo por entrega.** Si el pedido/factura/pago se cancela o revierte, los puntos se revierten.
3. **Base de cálculo:** **total pagado real de Odoo**. Los productos GF llevan IVA 0%, pero el motor **jamás asume IVA** (ni 0 ni 16): usa los valores reales.
4. **Familias/SKUs:** todas las familias comerciales elegibles suman. **Excluir**: fletes, ajustes, cargos administrativos y productos marcados como no elegibles. Se requiere elegibilidad configurable (no hardcodeada).
5. **Matriz comercial (requisito de motor):** reglas configurables por **compañía/plaza/ciudad × producto/SKU × categoría/familia**, con **multiplicador**, fecha inicio/fin, canal, activo y prioridad. Caso de uso: *en Iguala, Laurita 3.8 kg puede dar más puntos para empujar su venta* — campañas 2x/3x por SKU/plaza deben ser configuración, no código.
6. **Tasa base piloto:** **1% del total pagado en puntos**, con equivalencia **1 punto = $1 de valor promocional**. Los puntos NO son efectivo: solo se canjean en el catálogo autorizado.
7. **Vencimiento:** **180 días**, con **periodo de gracia de 90 días durante el piloto** antes de ejecutar expiración real. La PWA mostrará "puntos por vencer" cuando exista el endpoint.
8. **Canje:** máx. **1 canje/mes** por cliente · sin bloqueo por saldo vencido en fase inicial · modos `next_order` (producto físico con siguiente pedido) y `discount_next_invoice` (descuento en siguiente factura/pedido) · **canje automático SOLO si existe `gf_loyalty_redeem` atómico — sin método atómico, no se lanza canje automático** (se llama "solicitud de canje").
9. **Catálogo piloto (gate del live):** no se activa sin autorización. Recompensas sugeridas: $50 descuento siguiente pedido · $100 descuento siguiente pedido · producto gratis controlado · material POP · beneficio promocional de temporada.
10. **Directriz técnica (actualizada v3):** módulo hermano separado `gf_b2b_rewards`; **W14 no se extiende** (queda como referencia de evento operativo). ⚠️ Antes de crear cards B2B: validar en n8n qué hace el workflow `loyalty-expiry-check` (P6) — la expiración B2B usa cron propio que nace inactivo.

## Paquete de trabajo para Sebastián

| # | Entregable | Detalle | Depende de |
|---|-----------|---------|------------|
| S1 | **Aislamiento W14** | Criterio final: módulo hermano separado `gf_b2b_rewards`, W14 **NO se extiende** ni se reutiliza su mixin. Validar solo que el módulo nuevo no interfiere con W14/KoldHome y qué hace el workflow n8n `loyalty-expiry-check` (P6) | — |
| S2 | **Programa B2B** | `loyalty.program` en compañía 34 (Glaciem), canal tradicional; tasa base 1% del total pagado; 1 pt = $1 promocional | S1 |
| S3 | **Matriz comercial** | Modelo de reglas configurables plaza/ciudad × SKU/familia × multiplicador × vigencia × canal × prioridad (decisión 5). Puede ser extensión de `loyalty.rule` o modelo GF dedicado — propone Sebas | S1 |
| S4 | **Acumulación contado** | Trigger por **cobro confirmado** (`account.payment` GF + `cash_reception_status='received'` sin discrepancia; picking done solo precondición — NO patrón W14), escribiendo el libro `gf.rewards.*` (+ cache `loyalty.card`); base = total pagado real; exclusión de fletes/ajustes/cargos | S2, S3 |
| S5 | **Acumulación crédito** | Trigger al pago (`account.payment`/conciliación). Definir pagos parciales (proporcional vs al liquidar — propone Sebas, decide Yamil) | S2, S3 |
| S6 | **Reversa** | Cancelación de pedido/factura revierte puntos; caso "puntos ya gastados" (saldo negativo controlado / ajuste pendiente / bloqueo hasta compensar) — propone Sebas | S4/S5 |
| S7 | **Expiración** | 180 días con gracia de 90 en piloto; cron **propio** del módulo (nace inactivo); **validar el workflow n8n `loyalty-expiry-check` ANTES de crear cards** (P6) | S2 |
| S8 | **`gf_loyalty_redeem` atómico** | `(partner_id, reward_id, idempotency_key, channel)` con **`SELECT … FOR UPDATE NOWAIT`**, saldo desde el libro, **límite 1 canje/mes por unique index parcial** y cupos por **contadores transaccionales bloqueados** (NO `search_count`); descuenta FIFO, registra folio + `delivery_mode` + estado; errores tipados. Detalle: doc 07 v3 §7 | S2 |
| S9 | **Permisos RPC PWA** | Usuario de servicio de la PWA: read sobre `loyalty.program/card/reward/history` + execute sobre `gf_loyalty_redeem`. Correr el checklist de permisos de este doc con ESE usuario | S2 |
| S10 | **Card de prueba** | `loyalty.card` para partner 54907 (YAMIL TRADICIONAL) con puntos de prueba → habilita PR4 de la PWA contra datos reales | S2, S7 |

## Preguntas técnicas puntuales para Sebas

> Lista original de scoping. La lista **AUTORITATIVA y vigente es P1–P7 del doc 07 v3** (varias ya respondidas). Las de aquí se conservan como detalle de arranque.

1. ~~¿Extender W14?~~ **RESUELTO: módulo hermano separado, W14 no se toca** (doc 07 v3 §0). Queda P6: validar aislamiento y qué hace el workflow n8n `loyalty-expiry-check`.
2. ¿Cómo modelarías la matriz plaza/SKU/familia/multiplicador (¿`loyalty.rule` extendida o modelo GF dedicado?)?
3. ~~¿al entregar/cobrar?~~ **RESUELTO (P1): al cobro confirmado** — `account.payment` GF + `cash_reception_status='received'` sin discrepancia; picking done solo precondición.
4. ¿Cómo disparas acumulación de crédito al pago (¿`account.payment` post o conciliación)?
5. ¿Cómo reviertes puntos si se cancela pedido o factura (y qué pasa si ya se gastaron)?
6. ¿Qué hace exactamente el workflow n8n `loyalty-expiry-check` y cómo se garantiza que no toca puntos B2B? (el cron Odoo de W14 solo hace POST a n8n; P6)
7. ¿Cómo materializas 1 punto = $1 de valor promocional en `loyalty.reward` (required_points vs discount)?
8. ¿Cómo validas el máximo 1 canje/mes dentro de la transacción (mes calendario, por partner+programa)?
9. ¿Cómo implementas `gf_loyalty_redeem` atómico (constraint de idempotencia, folio, errores tipados)?
10. ¿Dónde registras `delivery_mode` (`next_order`/`discount_next_invoice`) y el estado de entrega/aplicación del canje?
11. ¿Cómo expones summary/catalog/history/redeem para la PWA (¿lectura directa de modelos nativos + método redeem, como propone este doc?)?
12. ¿Qué permisos exactos necesita el usuario RPC de la PWA y cuál es ese usuario?
13. ¿Qué card de prueba creas para YAMIL TRADICIONAL (54907) y con cuántos puntos, para arrancar PR4 read-only contra datos reales?

## Recomendación

**Híbrido nativo+custom con módulo hermano separado (`gf_b2b_rewards`):** modelos nativos como capa de datos — la PWA lee de ahí — y libro/lógica GF custom (matriz, acumulación por COBRO CONFIRMADO, reversa, `gf_loyalty_redeem` atómico). W14 NO se extiende. NO construir un sistema de puntos paralelo; NO depender del cómputo nativo de `sale_loyalty` (momento equivocado + no se dispara por RPC). Detalle completo: doc 07 v3.

**Siguiente paso:** entregar este documento a Sebastián (S1–S10 es su paquete; las 13 preguntas guían su propuesta técnica). En cuanto exista el programa B2B con la card de prueba (S10), la PWA arranca PR4 (rewards read-only) contra datos reales.

> **ACTUALIZACIÓN 2026-07-05:** Codex auditó el plan técnico (doc 07) con veredicto **REQUEST CHANGES before build** — 5 blockers (señal real de cobro de contado, FIFO con remaining/consumo por lote, row lock + constraint real en el canje, límites anti-configuración en la matriz, crédito fuera del MVP). El doc 07 v2 los incorpora junto con las decisiones de cierre de Yamil (caps 3x/5x, cap $500/cliente/mes, cupos por recompensa, saldo negativo controlado con regla formal, jerarquía libro→cache→vista). **Las preguntas operativas vigentes para Sebas son ahora las P1–P6 del doc 07** (la P1 —señal real de cobro— bloquea la primera acumulación real).
