# QA Checklist — Rewards B2B Fase 1 (módulo INACTIVO) en Odoo

**Fecha:** 2026-07-06 · **Estado: documento de aceptación — NO se ha entregado código aún.**
**Base:** plan técnico v3 mergeado en `grupofrio/clientes-tradicional-kolders` → `docs/rewards/ODOO_REWARDS_B2B_TECHNICAL_IMPLEMENTATION_PLAN.md` (§1, §2, §7, §9-Fase1, §H) + auditoría doc 06.
**Qué valida:** que la entrega de Sebastián para **Fase 1** sea un módulo **completo pero 100% inerte** — modelos, constraints, locks, tests y dry-run, **sin ningún efecto en producción**: sin programa real, sin cards, sin crons/automatizaciones activas, sin writes desde la PWA, sin n8n.
**Cómo usarlo:** cada ítem se marca ✅/❌ con evidencia (nombre de test, captura de estado del cron, salida de `search_count`, etc.). Un solo ❌ en los bloques A, C o L bloquea el paso a Fase 2.
**Método permitido para verificar:** lectura del código del PR/módulo + consultas Odoo **solo lectura** (`search_read`/`search_count`/`fields_get`) + ejecución de la suite de tests del módulo. **Cero writes de negocio.**

---

## A. Aislamiento del módulo (BLOQUEANTE)

| # | Check | Cómo se verifica | ✅/❌ |
|---|-------|------------------|------|
| A1 | Es un **módulo hermano nuevo y separado** (p.ej. `gf_b2b_rewards`), NO una modificación de `gf_w14_loyalty_engine` ni `gf_partner_loyalty` | El diff/PR no toca archivos de esos módulos; `__manifest__.py` es de un módulo nuevo | |
| A2 | **`depends` del manifest NO incluye** `gf_w14_loyalty_engine` ni `gf_partner_loyalty` | Leer `__manifest__.py`: deps esperadas = `loyalty`, `sale_loyalty`, `stock`, `account` (y base) — nada de W14/KoldHome | |
| A3 | No hereda (`_inherit`) modelos/mixins de W14 (`gf.w14.mixin`) ni toca `x_loyalty_streak`/`x_loyalty_level`/CSAT de `gf_partner_loyalty` | `grep` de `gf.w14`, `x_loyalty_streak`, `x_csat` en el módulo = cero | |
| A4 | No modifica el cron W14 (`ir.cron` id 89 "W14: Loyalty Expiry Check") ni sus automatizaciones | El cron W14 sigue con su `active`, `interval` y `nextcall` originales (search_read antes/después = idénticos salvo nextcall natural) | |
| A5 | No comparte `loyalty.program`/`loyalty.card` con B2C/KoldHome: no crea ni referencia programas de otras compañías | El módulo no crea datos en instalación (ver B) | |
| A6 | **(P6 del plan)** Documentado que se verificó qué hace el workflow n8n `loyalty-expiry-check` y que no toca puntos B2B | Nota de Sebas + evidencia read-only del workflow | |

## B. Inercia — sin efectos en producción (BLOQUEANTE)

| # | Check | Cómo se verifica | ✅/❌ |
|---|-------|------------------|------|
| B1 | **Cron(s) de expiración del módulo nacen `active=False`** | `search_read` de `ir.cron` del módulo → `active=False`; el XML de datos trae `active` eval `False` | |
| B2 | **Cron de notificaciones (si existe) nace `active=False`** | ídem | |
| B3 | **Automatizaciones (`base.automation`) del módulo nacen `active=False`** (el trigger de acumulación por cobro NO dispara) | `search_read` de `base.automation` del módulo → `active=False` | |
| B4 | **Sin programa real creado en instalación** — `loyalty.program` del canal B2B en compañía 34 NO existe todavía (eso es Fase 2) | `search_count(loyalty.program, [company_id=34, ...])` = 0 (sigue solo el seed "Gift Cards") | |
| B5 | **Sin cards reales** — `gf.rewards.accrual` / `gf.loyalty.card` / `gf.rewards.ledger` = 0 registros | `search_count` de cada modelo del libro = 0 | |
| B6 | **Sin `loyalty.card` nuevas** para partners B2B | `search_count(loyalty.card)` sin incremento vs línea base (0) | |
| B7 | Instalar el módulo NO crea datos de negocio (solo estructura + tal vez datos de config inertes/parámetros con defaults seguros) | Comparar `search_count` de los modelos del libro antes/después de instalar = 0/0 | |
| B8 | **Sin writes desde la PWA** — no existe `/api/rewards/*` en el repo de la PWA aún (Fase 4) y el módulo no expone endpoint web público | `ls src/app/api/rewards` en PWA = no existe; el módulo no define `http.Controller` con rutas activas de canje | |
| B9 | **Sin n8n** — el módulo no dispara webhooks en Fase 1 (la notificación de canje vive en el método atómico, que no se ejecuta con datos reales) | `grep` de URLs n8n en el módulo: si existen, están tras el método atómico no invocado; ningún `base.automation` activa que dispare | |

## C. Modelos del libro (§2 del plan) (BLOQUEANTE)

| # | Check | Cómo se verifica | ✅/❌ |
|---|-------|------------------|------|
| C1 | Existe **`gf.rewards.accrual`** (lote) con campos: `points_total`, `remaining_points`, `expires_at`, `source_model`, `source_id`, `state`, `card_id`/`partner_id`, `base_amount`, snapshots (plaza/company/warehouse/route/regla/multiplicador/tasa/base/impuestos/producto) | `fields_get` del modelo | |
| C2 | Existe **`gf.rewards.consumption`** (consumo FIFO) con `accrual_id`, `points`, `consumption_type` (`redemption/expiration/reversal_adjustment`), `redemption_id`, `date` | `fields_get` | |
| C3 | Existe **`gf.rewards.ledger`** (auditoría inmutable) con `event_type` (`accrual/redeem/reverse/expire/adjust`), `card_id`/`partner_id`, `points` (con signo), refs, `balance_after`, `actor`, `create_date` | `fields_get` | |
| C4 | Existe la **matriz comercial** (`gf.rewards.point.rule` o equivalente) con: `program_id`, `company_id`, `plaza_id` (=`account.analytic.account`), `product_id`, `categ_id`, `multiplier`, `rate_override`, `date_from/to`, `channel`, `partner_payment_type`, `active`, `priority`, `eligible`, `state` (`draft/approved/archived`) | `fields_get` | |
| C5 | Existe control de **cupos/presupuesto** por recompensa (campos en `loyalty.reward` vía `_inherit`: `gf_monthly_limit`, `gf_total_limit`, `gf_budget_amount`, `gf_plaza_ids`, `gf_date_from/to`) y la tabla de **contadores** `gf.rewards.quota` (`reward_id`, `period_key`, `limit_value`, `consumed_value`) | `fields_get` de `loyalty.reward` + del modelo quota | |
| C6 | Jerarquía de verdad documentada en el código: libro (`accrual/consumption/ledger`) = fuente; `loyalty.card.points` = **cache reconciliable**; `loyalty.history` = vista | Comentarios/docstrings + campo `remaining_points` marcado como derivado | |

## D. Constraints e integridad (§9-F1) (BLOQUEANTE)

| # | Check | Cómo se verifica | ✅/❌ |
|---|-------|------------------|------|
| D1 | **Puntos positivos:** `points_total > 0` en accrual (CHECK BD o `_constraint`) | Intento de crear accrual con 0/negativo falla en test | |
| D2 | **`remaining_points >= 0`** (salvo el ajuste negativo explícito, que vive en accrual tipo `reversal_adjustment`, no en `remaining`) | CHECK BD; test que intenta dejar remaining negativo falla | |
| D3 | **Consumptions positivas:** `consumption.points > 0` | CHECK BD; test | |
| D4 | **Unique de acumulación (idempotencia):** unique `(card_id, source_model, source_id)` en accrual — un mismo documento no acumula dos veces | Índice/constraint presente; test de doble inserción falla la 2ª | |
| D5 | **Unique de idempotency_key** en `gf.rewards.redemption` | Constraint presente; test | |
| D6 | **`redeem_month` / límite mensual:** unique index **parcial** sobre `month_key WHERE state != 'cancelled'` — máx. 1 canje/mes por cliente a nivel BD | Índice parcial en el `__init__`/migración SQL; test de 2 canjes mismo mes falla el 2º | |
| D7 | **Integridad FIFO:** `remaining_points = points_total − Σconsumption` verificada (constraint o test + job de reconciliación) | Test inyecta divergencia y el job la detecta | |
| D8 | **Cupos:** `CHECK (quota.consumed_value <= quota.limit_value)` en BD | Constraint presente; test | |
| D9 | Caps de matriz: `multiplier ≤ 3.0` normal; `3.0 < multiplier ≤ 5.0` requiere `exceptional_approval`; `>5.0` imposible (`ValidationError`); `rate_override` acotado | Tests de validación de reglas | |

## E. Locks del canje (§7) (BLOQUEANTE para el diseño; el método no se ejecuta con datos reales)

| # | Check | Cómo se verifica | ✅/❌ |
|---|-------|------------------|------|
| E1 | `gf_loyalty_redeem` usa **`SELECT id FROM loyalty_card WHERE id=%s FOR UPDATE NOWAIT`** (lock real, sin espera) | Leer el código del método; `grep "FOR UPDATE NOWAIT"` | |
| E2 | **Manejo de lock ocupado:** captura el error de lock (psycopg2 LockNotAvailable) y devuelve error tipado **`redeem_busy`** (no excepción cruda) | Código + test de concurrencia (dos transacciones: una obtiene lock, la otra → `redeem_busy`) | |
| E3 | **Deadlock handling:** política definida (fail-fast con error tipado o retry acotado); documentado en P7 | Código/nota de Sebas; test si aplica | |
| E4 | Saldo validado **desde el libro** (Σ`remaining_points`), no desde el cache, dentro del lock | Leer el método | |
| E5 | **Replay** solo si `partner_id` Y `reward_id` coinciden con la redemption de esa key; si no → `idempotency_conflict` | Test de replay + test de conflicto | |
| E6 | Cupos validados con **contadores transaccionales bloqueados** (`gf.rewards.quota` con `FOR UPDATE NOWAIT`), **NO con `search_count`** | `grep` de `search_count` en la ruta de validación de cupos = ausente; lógica sobre quota | |

## F. Dry-run (§9-F1)

| # | Check | Cómo se verifica | ✅/❌ |
|---|-------|------------------|------|
| F1 | Existe un método **dry-run** que recibe un pedido/picking/cobro y **devuelve los puntos que SE ASENTARÍAN** (regla aplicada, base, multiplicador, cap) | Ejecutar el método sobre un pedido histórico leído | |
| F2 | El dry-run **NO crea** `gf.rewards.accrual` ni `consumption` ni `ledger` | `search_count` de los 3 modelos antes/después del dry-run = igual | |
| F3 | El dry-run **NO modifica `loyalty.card.points`** | `read` de card.points antes/después = idéntico (o no hay card) | |
| F4 | El dry-run **NO crea `loyalty.history`** real | `search_count(loyalty.history)` antes/después = igual | |
| F5 | El dry-run aplica la matriz correctamente (usa el ejemplo canónico: $5,000 elegibles a 1% = 50 pts; con multiplicador de plaza aplica el factor) | Test del dry-run con casos de matriz | |

## G. Momento de acumulación = cobro confirmado (§5-bis)

| # | Check | Cómo se verifica | ✅/❌ |
|---|-------|------------------|------|
| G1 | **`stock.picking done` NO es el trigger** de acumulación (queda como precondición/referencia, nunca señal suficiente) | El `base.automation` de acumulación NO dispara solo por picking `done`; su dominio exige la señal de cobro | |
| G2 | La señal de acumulación es **cobro confirmado** (`account.payment` GF + `cash_reception_status='received'` sin discrepancia); `discrepancy_pending` NO acumula | Leer el dominio/condición del trigger; test de elegibilidad (payment sin recepción → no; discrepancy_pending → no; received → sí, en dry-run) | |
| G3 | **Crédito fuera del MVP:** el hook sobre `account.partial.reconcile` **no está activo** (diseñado + testeado, no instalado activo) | La automation/hook de crédito está inactiva o no registrada; tests de crédito existen pero no se dispara en runtime | |
| G4 | Tarjeta/transferencia: diseñables pero **no activas** en piloto | Config/flag apagado | |

## H. Suite de tests (§9-F1)

| # | Test presente y verde | ✅/❌ |
|---|------------------------|------|
| H1 | **Matriz:** precedencia (`eligible=false` > SKU > plaza exacta > `priority`), caps, exclusiones, vigencias | |
| H2 | **FIFO:** emisión, consumo multi-lote, expiración parcial, reversa | |
| H3 | **Redondeo:** cálculo por línea vs asiento, redondeo comercial al final, puntos enteros, ejemplo canónico | |
| H4 | **Idempotencia de acumulación:** doble señal del mismo documento no duplica | |
| H5 | **Concurrencia de canje:** dos transacciones simultáneas → una gana lock, otra `redeem_busy`; replay correcto | |
| H6 | **Cupos bajo concurrencia:** dos canjes simultáneos no exceden `monthly/total/budget/stock` | |
| H7 | **Rollback/reversa:** cancelación revierte por el libro (asiento inverso, sin editar/borrar); caso "puntos ya gastados" → saldo negativo controlado + bloqueo natural | |
| H8 | **Elegibilidad de cobro:** payment sin recepción no acumula; `discrepancy_pending` no; `received` sí | |
| H9 | **Reconciliación libro vs cache:** el job detecta una divergencia inyectada | |
| H10 | Todos los tests corren en CI y pasan (evidencia del run) | |

## I. Permisos (P4)

| # | Check | Cómo se verifica | ✅/❌ |
|---|-------|------------------|------|
| I1 | **El usuario RPC de servicio de la PWA NO tiene write** sobre los modelos del libro en Fase 1 (solo lo tendrá `execute` del método atómico en Fase 5) | `ir.model.access` / record rules: el grupo del usuario PWA no tiene `perm_write/create/unlink` sobre `gf.rewards.*` | |
| I2 | En Fase 1 el usuario PWA a lo sumo tiene **read** sobre `loyalty.program/card/reward/history` (para Fase 4), nunca write | Revisar ACLs | |
| I3 | `unlink` sobre `gf.rewards.accrual/consumption/ledger` **prohibido** salvo admin técnico (ver rollback) | ACL/constraint | |
| I4 | Confirmado **cuál** es el usuario RPC real de la PWA (el del env de Vercel) y que se corrió el checklist con ESE usuario | Nota de Sebas (resuelve el pendiente P4) | |

## J. Rollback (§H)

| # | Check | Cómo se verifica | ✅/❌ |
|---|-------|------------------|------|
| J1 | **Pre-datos (Fase 1-2 sin acumulaciones):** desinstalar el módulo es limpio; programa/card de prueba se **archivan**, no `unlink` | Documentado; probar desinstalación en staging si existe | |
| J2 | **Post-datos (Fase 3+):** desinstalar NO es rollback; el orden es **desactivar automatizaciones/crons → reversar por el libro → archivar** | Documentado en el módulo/README | |
| J3 | **`unlink` del libro prohibido** (accrual/consumption/ledger) por ACL + constraint | Test que intenta unlink como usuario normal falla | |
| J4 | La reversa se hace **por evento inverso** (nunca editando/borrando registros del libro) | Diseño del método de reversa | |

---

## Resumen ejecutivo (Yamil / Sebas)

**Qué es esto:** la lista de aceptación para cuando Sebastián entregue **Fase 1** de Rewards B2B. La regla de oro de Fase 1 es **"módulo completo pero inerte"**: toda la estructura (modelos del libro, matriz, constraints, locks, tests, dry-run) debe existir y estar probada, pero **cero efecto en producción** — sin programa, sin cards, con crons y automatizaciones apagados, sin tocar la PWA ni n8n, y sin depender de W14/KoldHome.

**Cómo se aprueba:** cada bloque se marca con evidencia (test verde, `search_count=0`, estado del cron, código del lock). Los bloques **bloqueantes** son A (aislamiento), B (inercia), C (modelos), D (constraints) y L=E/I/J (locks, permisos, rollback): un solo ❌ ahí frena el avance a Fase 2.

**Los 3 riesgos que este checklist cierra:**
1. Que el módulo "toque" el B2C sin querer → bloques A y G1.
2. Que se "encienda" algo en producción por accidente (un cron activo, un programa creado en instalación) → bloque B.
3. Que la contabilidad de puntos tenga huecos de concurrencia/idempotencia antes de tener un solo cliente → bloques D, E, H.

**Lo que NO se prueba en Fase 1** (es de fases posteriores, con su propio S/N): acumulación real con clientes, el programa B2B vivo, la card de prueba de YAMIL TRADICIONAL, los endpoints `/api/rewards/*` de la PWA, y el canje en vivo. Fase 1 solo garantiza que el motor está bien construido y **apagado**.

**Preguntas de Sebas que este checklist ayuda a cerrar:** P4 (usuario RPC y permisos → bloque I), P6 (aislamiento W14 + workflow n8n de expiry → A4/A6), P7 (implementación de índices parciales/NOWAIT/migraciones → D6/E1). P1/P2/P3 ya resueltas en el plan v3.

**Siguiente paso:** entregar este checklist a Sebastián junto con el plan v3 (ya en main, `docs/rewards/`). Cuando entregue la Fase 1, se corre el checklist (lectura de código + tests + consultas Odoo solo-lectura); si todo ✅, Yamil da S/N para Fase 2 (programa + card de prueba).
