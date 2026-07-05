# Plan Técnico de Implementación — Rewards B2B en Odoo (Portal de Clientes Grupo Frío)

**Versión 3 — 2026-07-05** · incorpora los **comments finales de Codex (APPROVE with comments)** y la **validación técnica de Sebastián** (Fase 1 segura con contratos estrictos).
**Estado: SOLO DISEÑO — cero writes ejecutados en Odoo, n8n o PWA. NO construir todavía.**
**Regla de ejecución:** ninguna fase sin S/N de Yamil; los writes en Odoo los ejecuta **Sebastián (owner técnico)** con este documento como spec.

---

## Changelog v2 → v3 (Codex comments + validación Sebastián)

| # | Origen | Cambio | Sección |
|---|--------|--------|---------|
| C1 | Codex | Doc read-only alineado: **NO se extiende W14** — módulo hermano separado; W14 solo referencia de evento operativo y aislamiento a validar | §0 + doc 06 corregido |
| C2 | Codex | Regla explícita de **precisión/redondeo** de puntos (enteros, redondeo comercial al final del asiento) con ejemplo | §3.1 |
| C3 | Codex | **Locking de cupos/presupuesto**: prohibido validar cupos con `search_count`; contadores transaccionales bloqueados en la misma transacción | §7.2 |
| C4 | Codex | Aclaración **`remaining_points`** = derivado/denormalizado actualizable; la inmutabilidad aplica a eventos de negocio, no a caches técnicos controlados | §2.1 |
| C5 | Codex | Nueva **P7** para Sebas (índices parciales, NOWAIT, post-commit, migraciones, concurrencia, deadlocks, rollback) | §P |
| C6 | Codex | Fase 1 refuerza **CHECKs y tests** (no-negativos, redondeo, reconciliación, concurrencia, cupos) | §9 F1 |
| S1 | Sebastián | **Señal de cobro FINAL (resuelve P1): el evento elegible NO es entrega, es COBRO CONFIRMADO** — `account.payment` GF + recepción de efectivo de ruta sin discrepancia | §5-bis v3 |
| S2 | Sebastián | Nomenclatura y estructura: **`gf.rewards.accrual` / `gf.rewards.consumption` / `gf.rewards.ledger`** (ledger inmutable nuevo); `loyalty.card.points` solo cache | §2 |
| S3 | Sebastián | Canje atómico con **`SELECT … FOR UPDATE NOWAIT`** (lock real, sin espera bloqueante) | §7.1 |

---

## 0. Motor W14 — criterio FINAL (C1)

`gf_w14_loyalty_engine` (leído su código fuente): emisor de webhooks post-entrega + cron hacia n8n; el loyalty B2C son streaks de `gf_partner_loyalty`, no `loyalty.card`.

**Criterio final para B2B (cierra la discusión de v1/v2):**
- **NO se extiende W14.** Módulo hermano B2B completamente separado.
- W14 queda únicamente como: (a) **referencia de evento operativo** (demuestra que el ecosistema ya reacciona a eventos de entrega — pero para B2B el evento elegible es OTRO, ver §5-bis), y (b) **aislamiento a validar** (P6: confirmar que nada del módulo nuevo interfiere con W14/KoldHome y qué hace el workflow n8n `loyalty-expiry-check` antes de crear cards).
- **Cero dependencia de KoldHome/B2C.**

## 1. Arquitectura (confirmada)

Módulo hermano — **nomenclatura recomendada v3: `gf_b2b_rewards`** (alineada a los modelos `gf.rewards.*` de Sebastián; el nombre final lo fija Sebas) — deps `loyalty`, `sale_loyalty`, `stock`, `account`. Nativos como capa de presentación/datos; custom para matriz/acumulación/reversa/canje/ledger.

## 2. Modelos y campos — v3 (nomenclatura Sebastián + ledger)

> Se adopta **`gf.rewards.*`** como nomenclatura recomendada (sustituye los nombres `gf.loyalty.*` de v2 — mismo diseño, nombres finales de Sebastián). Sin código todavía.

### 2.1 Jerarquía de verdad (con aclaración C4)

| Capa | Modelos | Rol |
|------|---------|-----|
| **LIBRO (fuente de verdad auditable)** | `gf.rewards.accrual` + `gf.rewards.consumption` + `gf.rewards.redemption` + **`gf.rewards.ledger`** | Eventos de negocio. **Inmutables: los eventos jamás se editan/borran — solo se agregan eventos nuevos (reversa = evento inverso)** |
| **DERIVADOS/CACHES técnicos controlados** | `remaining_points` (en el lote) · `loyalty.card.points` (saldo agregado) | **Actualizables por diseño** — denormalizaciones para queries calientes (expiración, summary). Siempre recalculables desde el libro; job de reconciliación los verifica. La regla "no editar movimientos" NO les aplica: aplica a los eventos, no a los caches |
| **VISTA para PWA** | `loyalty.history` | Espejo legible. No fuente de verdad |

### 2.2 `gf.rewards.accrual` — lote de acumulación

Campos (nomenclatura Sebastián): `card_id`/`partner_id` · **`points_total`** (emitidos, inmutable) · **`remaining_points`** (derivado vivo del lote) · `expires_at` · `source_model`/`source_id` (**SQL unique con card_id** — anti doble acumulación) · `sale_order_id` · `state` (`posted/exhausted/expired/reversed`) · snapshots de v2 completos (plaza/company/warehouse/route/regla/multiplicador/tasa/base/impuestos/productos — el histórico no cambia si el partner cambia de plaza).

### 2.3 `gf.rewards.consumption` — consumo FIFO

Liga cada canje/expiración/ajuste contra **uno o más lotes** FIFO: `accrual_id`, `points`, `consumption_type` (`redemption/expiration/reversal_adjustment`), `redemption_id`, `date`. Integridad: `remaining_points = points_total − Σconsumption` (verificada en tests + job de reconciliación).

### 2.4 `gf.rewards.ledger` — auditoría inmutable (NUEVO, S2)

Un registro por **cada evento de negocio**, de solo-inserción (create-only; write/unlink bloqueados por access rules + constraint): `event_type` (`accrual / redeem / reverse / expire / adjust`), `card_id`/`partner_id`, `points` (con signo), `accrual_id`/`consumption_id`/`redemption_id` (refs), `balance_after` (saldo resultante), `actor` (usuario/canal), `payload_snapshot` (json), `create_date`. Es la línea de tiempo completa para auditoría fiscal/comercial y la base contra la que se reconcilia todo lo derivado.

### 2.5 `gf.rewards.redemption` — canjes

Sin cambios de fondo vs v2: folio (`ir.sequence`), `delivery_mode`, `state`, `idempotency_key` (unique), `month_key` (unique parcial §7.1), `notify_state/attempts`, snapshots.

### 2.6 `gf.rewards.point.rule` — matriz comercial

Sin cambios vs v2 (plaza=`account.analytic.account` × SKU × categoría × multiplicador × vigencia × canal × tipo cliente × `eligible` × prioridad; caps 3x/5x-aprobado; cap $500/cliente/mes; precedencia formal; draft/approved; chatter). Renombrada a `gf.rewards.*`.

### 2.7 Cupos por recompensa

Sin cambios vs v2 (`_inherit loyalty.reward`: `gf_monthly_limit/gf_total_limit/gf_budget_amount/gf_plaza_ids/gf_date_from/to`) + **contadores transaccionales** para su validación (§7.2).

## 3. Reglas de negocio (v3)

Todo lo de v2 más:

### 3.1 Precisión y redondeo de puntos (C2 — regla explícita)

- Base económica: **total pagado real en MXN** (valores reales de Odoo, jamás asumir IVA).
- Tasa base: **1%** · equivalencia: **1 punto = $1 MXN de valor promocional**.
- **Cálculo por línea elegible** (para aplicar matriz/exclusiones por SKU) → **acumulación a nivel asiento/documento** → **redondeo AL FINAL del asiento, una sola vez**.
- **Puntos ENTEROS** (recomendación adoptada): redondeo comercial (half-up) del total del asiento. Las diferencias por redondear al final (vs por línea) son de centavos de punto y quedan documentadas como comportamiento esperado; el snapshot del asiento guarda la suma sin redondear para auditoría.
- **Ejemplo canónico:** compra elegible de $5,000 a tasa base 1% = **50 puntos** = **$50 de valor promocional** → la recompensa "$50 de descuento" requiere **50 puntos**.

## 4. Cron de expiración (sin cambios vs v2)

Cron propio, nace INACTIVO, gracia 90d, expira `remaining_points` por lote (parcial correcto), cada expiración escribe consumption + ledger + history. W14 intocado.

## 5-bis. Señal real de cobro — v3 FINAL (S1, resuelve P1)

**Principio (cambio crítico confirmado por Sebastián): el evento elegible para acumulación B2B NO es la entrega — es el COBRO CONFIRMADO según la ruta administrativa actual.** `stock.picking done` puede quedar como **precondición o referencia** (nada no-entregado acumula), **nunca como señal suficiente**. (El W14 dispara post-entrega desde picking, pero eso solo prueba entrega — por eso NO se replica ese disparo para rewards.)

**Contrato de elegibilidad para CONTADO EFECTIVO (MVP):**
1. Existe **`account.payment` GF** ligado al cobro, **y además**
2. la ruta tiene **recepción de efectivo SIN discrepancia**: `cash_reception_status = 'received'` (o el estado final equivalente del flujo administrativo de ruta).
3. Si `cash_reception_status = 'discrepancy_pending'` → **NO acumula todavía** (acumula cuando la discrepancia se resuelva a `received`).
4. **Crédito: fuera del MVP** (diseño+tests, hook inactivo — sin cambios vs v2).
5. **Tarjeta/transferencia: se pueden diseñar, NO se activan en el piloto** sin confirmación externa sólida del medio de pago (anti-fraude: un "pago" con tarjeta no confirmado no es cobro).

Trigger técnico: evento de cobro confirmado (write de `cash_reception_status` → `received` con payment ligado, o el hook que Sebas defina sobre su flujo de recepción de efectivo), con el picking `done` verificado como precondición. La doble señal no duplica: el unique del lote por documento fuente lo garantiza.

## 6. Reversa (sin cambios de fondo vs v2)

Regla formal de 3 pasos para "puntos ya gastados" (cancelar redemption pendiente → ajuste negativo → bloqueo natural por saldo). v3 agrega: **toda reversa escribe también su evento en `gf.rewards.ledger`**. Nuevo caso alineado a §5-bis: si un cobro acumulado luego se marca con discrepancia/se cancela el payment → reversa del lote ligado a ese cobro.

## 7. Canje atómico `gf_loyalty_redeem` — v3

### 7.1 Lock real (S3)

```sql
SELECT id FROM loyalty_card WHERE id = %s FOR UPDATE NOWAIT
```
- **`NOWAIT`**: si otra transacción tiene el lock, NO se espera — se captura el error de lock y se responde **`redeem_busy`** (error tipado); la PWA muestra "Estamos procesando otro movimiento de tu cuenta, intenta en unos segundos" y puede reintentar con la MISMA idempotency_key (si el rival era el mismo canje → replay con el folio).
- El saldo se valida **desde el libro** (Σ`remaining_points` de lotes posted) dentro del lock; divergencias contra el cache se loggean.
- Límite mensual del cliente: **unique index parcial** sobre `month_key WHERE state != 'cancelled'` (la BD es la barrera; el check previo solo da el error amigable).
- Replay: solo si `partner_id` **y** `reward_id` coinciden con la redemption existente de esa key; si no → `idempotency_conflict`.

### 7.2 Cupos y presupuesto SIN `search_count` (C3)

**Prohibido validar cupos con `search_count`** (dos canjes simultáneos lo burlan: ambos cuentan N−1 y ambos insertan). Mecanismo v3 — **contadores transaccionales bloqueados**:

- Tabla `gf.rewards.quota` (una fila por reward × periodo × tipo de cupo): `reward_id`, `period_key` (`'2026-07'` para monthly / `'total'` / `'budget'`), `limit_value`, `consumed_value`.
- Dentro de la MISMA transacción del canje: `SELECT … FOR UPDATE NOWAIT` sobre la(s) fila(s) de quota del reward → verificar `consumed + costo ≤ limit` → incrementar `consumed` → si excede: **`reward_quota_exceeded`** sin insertar nada.
- Refuerzo de integridad: `CHECK (consumed_value <= limit_value)` en BD — aunque un bug burle la lógica, la BD rechaza.
- Cubre simultáneos sobre: `monthly_limit`, `total_limit`, presupuesto (`gf_budget_amount`, consumido en $ promocionales) y stock/cupo asignado por plaza si se configura.
- Las filas de quota se crean/renuevan con el catálogo (evento auditado en ledger tipo `adjust`).

Todo lo demás del contrato v2 (folio, delivery_mode, estados, errores tipados, notificación n8n **post-commit con retry y sin rollback**) sigue vigente.

## 8. Contrato Odoo → PWA (sin cambios vs v2)

`summary` del cache + `redeem` contra el libro; `expiring` desde lotes; la PWA jamás escribe modelos — solo llama el método.

## 9. Plan por fases — v3 (Fase 1 reforzada, C6)

Cambios sobre la tabla v2 (el resto de fases igual):

**Fase 1 — módulo inactivo, spec reforzada:**
- Modelos `gf.rewards.*` + **ledger create-only** + constraints: uniques (lote por fuente, idempotency_key, month_key parcial), **CHECKs en BD**: `points_total > 0`, `consumption.points > 0`, `remaining_points >= 0` (salvo el caso explícito de ajuste negativo, que vive en accrual negativo tipo `reversal_adjustment`, no en remaining), `quota.consumed <= quota.limit`.
- **Tests obligatorios:** matriz (precedencia/caps/exclusiones/vigencias) · FIFO (emisión/consumo multi-lote/expiración parcial/reversa) · **redondeo** (por línea vs asiento, ejemplos canónicos §3.1) · **reconciliación libro vs cache** (job detecta divergencia inyectada) · idempotencia de acumulación (doble señal) · **concurrencia de canje** (dos transacciones simultáneas: una gana lock, otra `redeem_busy`; replay correcto) · **cupos/presupuesto bajo concurrencia** (dos canjes simultáneos no exceden quota) · elegibilidad de cobro (payment sin recepción NO acumula; `discrepancy_pending` NO acumula; resolución a `received` SÍ).
- Cron expiración APAGADO · cron notificaciones APAGADO · automatizaciones APAGADAS · sin programa real · sin cards · sin n8n · sin writes PWA · **dry-run** que simula puntos (regla aplicada, base, cap) sin asentar.

**Fase 3 — desbloqueada en diseño:** P1 quedó respondida (señal = cobro confirmado §5-bis); la fase arranca cuando el flujo `cash_reception_status` esté conectado y validado con el partner de prueba 54907.

## H. Rollback (sin cambios vs v2)

Pre-datos: desinstalar limpio. Post-datos: desactivar → reversar por libro → archivar; unlink prohibido en el libro.

---

## Preguntas para Sebas — estado v3

| # | Pregunta | Estado |
|---|----------|--------|
| P1 | Señal real de cobro contado | ✅ **RESPONDIDA (S1):** cobro confirmado = `account.payment` GF + `cash_reception_status='received'` sin discrepancia; picking done solo precondición. Pendiente operativo: conectar/confirmar ese estado en el flujo real de ruta |
| P2 | Row lock + deadlocks | ✅ Validado con contrato `FOR UPDATE NOWAIT` (S3); detalle fino de deadlocks pasa a P7 |
| P3 | Modelo FIFO | ✅ **RESPONDIDA (S2):** `gf.rewards.accrual/consumption/ledger` con `points_total/remaining_points`; adoptado en §2 |
| P4 | Usuario RPC PWA y permisos | 🟡 Pendiente |
| P5 | `x_analytic_un_id` como llave de plaza + `route_id` | 🟡 Pendiente |
| P6 | Aislamiento KoldHome/B2C + qué hace el workflow n8n `loyalty-expiry-check` | 🟡 Pendiente (bloquea Fase 2) |
| **P7** | **(NUEVA, C5)** ¿Cómo implementarás en Odoo/Odoo.sh: índices SQL parciales (¿init hook/migración SQL directa?), locks `FOR UPDATE NOWAIT` desde ORM, post-commit hooks, migraciones de esquema, **pruebas de concurrencia** en CI, manejo de deadlocks (retry vs fail-fast), y rollback de migraciones si algo sale mal en deploy de Odoo.sh? | 🟡 Pendiente |

## Recomendación final (sin cambios)

1. **NO construir todavía** — v3 lista para OK final de Codex/Sebas + S/N de Yamil sobre esta versión.
2. PR #14 (home PWA) sigue su curso en paralelo, sin mezclarse con este PR.
3. Fase 1 solo tras S/N, con Sebastián como owner técnico.
