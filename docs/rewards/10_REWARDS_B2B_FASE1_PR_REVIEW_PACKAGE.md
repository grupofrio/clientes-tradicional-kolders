# Paquete de revisión — PR Odoo Rewards B2B Fase 1 (para cuando Sebastián entregue)

**Fecha:** 2026-07-07 · **Estado: preparado, NO ejecutado.** Documento local de apoyo; no se corre contra Odoo hasta que exista el PR/módulo y con S/N.
**Base:** checklist aprobado `docs/rewards/08_REWARDS_B2B_FASE1_QA_CHECKLIST.md` + plan técnico v3 `docs/rewards/ODOO_REWARDS_B2B_TECHNICAL_IMPLEMENTATION_PLAN.md` (ambos en `main` de la PWA).
**Regla de oro de Fase 1:** módulo **completo pero inerte** — estructura + tests + dry-run, **cero efecto en prod** (sin programa/cards, crons y automations apagados, sin PWA writes, sin n8n, sin depender de W14/KoldHome).
**Convención:** en los comandos, `MOD` = carpeta del módulo (esperado `gf_b2b_rewards`; ajustar al nombre final de Sebas). Todo es **lectura**: `git grep`/`git show`/`rg` sobre el PR + `search_read/search_count/fields_get` sobre Odoo. **Cero writes.**

---

## 1. Checklist resumido A–J (tabla de evaluación del PR)

| Bloque | Qué valida | Bloqueante | Resultado (✅/❌/N-A) | Evidencia |
|--------|-----------|:----------:|:-------------------:|-----------|
| **A. Aislamiento** | Módulo hermano nuevo; `depends` sin `gf_w14_loyalty_engine`/`gf_partner_loyalty`/`koldhome_*`; no hereda `gf.w14.mixin`; no toca cron W14 (id 89) ni streaks/CSAT | **SÍ** | | |
| **B. Inercia** | Crons `active=False`; automations `active=False`; sin programa real (cía 34); sin cards; instalar NO crea datos de negocio; sin `/api/rewards` en PWA; sin webhooks n8n | **SÍ** | | |
| **C. Modelos del libro** | `gf.rewards.accrual` (lote: points_total/remaining_points/expires_at/source_model/source_id/state + snapshots), `gf.rewards.consumption` (FIFO), `gf.rewards.ledger` (inmutable), matriz `gf.rewards.point.rule` (plaza×SKU×multiplier×vigencia×eligible×priority×state), cupos `gf.rewards.quota` | **SÍ** | | |
| **D. Constraints** | `points_total>0`; `remaining_points>=0`; `consumption.points>0`; unique `(card,source_model,source_id)`; unique `idempotency_key`; unique parcial `month_key WHERE state!=cancelled`; `CHECK(quota.consumed<=limit)`; caps multiplier (≤3 / ≤5-aprob); sin floats de negocio sin control | **SÍ** | | |
| **E. Locks** | `SELECT … FOR UPDATE NOWAIT` sobre `loyalty.card`; orden determinístico; error tipado `redeem_busy`; manejo deadlock; cupos por contador transaccional bloqueado, **NO `search_count`** | **SÍ** | | |
| **F. Dry-run** | Calcula puntos esperados; **no crea** accrual/consumption/ledger; no toca `loyalty.card.points`; no crea `loyalty.history`; reporta pagos elegibles/bloqueados + motivos | No | | |
| **G. Cobro confirmado** | `stock.picking done` **NO** es trigger; acumula solo por **cobro confirmado** (predicado §G-bis); crédito fuera del MVP; tarjeta/transfer no activas | **SÍ** | | |
| **H. Tests** | matriz · FIFO · redondeo · idempotencia · locks/concurrencia · cupos · rollback/reversa · permisos · reconciliación libro/cache · elegibilidad de cobro | No (calidad) | | |
| **I. Permisos** | Usuario RPC/PWA **sin write** de rewards en F1; grupo reader separado; sin `sudo()` sin tenancy; `unlink` del libro prohibido | **SÍ** | | |
| **J. Rollback** | Pre-datos: desinstalar limpio. Post-datos: desactivar→reversar→archivar; **nunca unlink del libro** | No | | |

*Regla de dictamen:* un solo ❌ en un bloque **bloqueante** (A·B·C·D·E·G·I) ⇒ no pasa a Fase 2.

### G-bis. Predicado de "cobro confirmado" (debe estar implementado tal cual)

**Acumula SOLO si TODAS se cumplen:**
- `account.payment.state in ('paid','in_process')`
- `gf_payment_method_bucket == 'cash'`
- `gf_payment_flow_state not in ('cancelled','exception')`
- `gf.route.plan.cash_reception_status in ('received','validated')`
- `abs(cash_discrepancy_amount) <= 0.01`

**Bloquean la acumulación:** `pending` · `discrepancy_pending` · pagos `draft/canceled/rejected` · crédito · branch ambiguo · payment sin orden/líneas resolubles · duplicados por idempotency key.

---

## 2. Comandos/greps seguros sobre el PR (lectura del código)

> Ejecutar en el clon del repo Odoo (`~/dev/GrupoFrio`), tras `git fetch` y sobre la rama del PR (`git checkout <rama-PR>` o `git show <rama>:...`). `MOD=gf_b2b_rewards` (ajustar).

```bash
MOD=gf_b2b_rewards   # nombre final de Sebas

# A. depends del manifest — NO debe incluir W14/partner_loyalty/koldhome
sed -n '/depends/,/]/p' "$MOD/__manifest__.py"
grep -nE "gf_w14_loyalty_engine|gf_partner_loyalty|koldhome" "$MOD/__manifest__.py"   # esperado: VACÍO
grep -rn "gf.w14.mixin|x_loyalty_streak|x_loyalty_level|x_csat" "$MOD/"                # esperado: VACÍO

# A/B. crons y automations deben nacer active=False
grep -rnE "ir.cron|ir_cron" "$MOD/" --include=*.xml
grep -rniE "active.{0,20}(True|1)" "$MOD/"data*/*.xml 2>/dev/null                       # revisar cada hit: NO en crons/automations
grep -rniE "base.automation|ir.actions.server" "$MOD/" --include=*.xml
#   → confirmar <field name="active" eval="False"/> en cada cron/automation

# E. locks: FOR UPDATE NOWAIT presente; search_count NO usado para cupos
grep -rn "FOR UPDATE NOWAIT" "$MOD/"                                                    # esperado: en el redeem
grep -rn "redeem_busy" "$MOD/"
grep -rn "search_count" "$MOD/"                                                         # revisar: NO en validación de cupos

# writes/mutaciones: mapear todos los create/write/unlink (deben ser del libro, no de loyalty.card.points a mano)
grep -rnE "\.(create|write|unlink)\(" "$MOD/models/"
grep -rn "sudo()" "$MOD/"                                                               # revisar cada uno: con tenancy/justificado

# C. modelos gf.rewards.* presentes
grep -rnE "_name = ['\"]gf\.rewards\.(accrual|consumption|ledger|point\.rule|quota)['\"]" "$MOD/models/"

# D. constraints
grep -rnE "_sql_constraints|@api.constrains|CHECK ?\(" "$MOD/models/"
grep -rnE "month_key|idempotency_key|remaining_points|points_total" "$MOD/models/"

# F. dry-run: método que simula sin asentar
grep -rniE "dry.?run|simulate|preview" "$MOD/"

# G. cobro confirmado (NO picking done)
grep -rnE "stock.picking|picking.*done|state.*done" "$MOD/"                             # revisar: picking NO como trigger
grep -rnE "account.payment|cash_reception_status|gf_payment_flow_state|cash_discrepancy" "$MOD/"

# I. permisos: access rules + record rules; el usuario PWA sin write
cat "$MOD/security/ir.model.access.csv"                                                 # perm_write/create/unlink = 0 para el grupo PWA
grep -rn "record" "$MOD/security/"*.xml 2>/dev/null

# H. tests presentes
ls "$MOD/tests/"; grep -rlnE "def test_" "$MOD/tests/" | sed 's/^/  test: /'
grep -rniE "matriz|matrix|fifo|redondeo|round|idempot|concurren|lock|cupo|quota|rollback|revers|permis" "$MOD/tests/"
```

**Cómo correr los tests (dev/staging, NO prod):** `odoo -d <db_dev> -i $MOD --test-enable --stop-after-init` (o el runner de Sebas). Nunca en prod.

---

## 3. Consultas Odoo read-only (plantilla — NO ejecutar hasta S/N)

> Mismo patrón guardado de siempre: `assert method in {"search_read","search_count","fields_get","read"}`. Cero writes. Solo para confirmar que la Fase 1 **no dejó nada activo/real** en prod.

```python
# READ-ONLY — validación de inercia de la Fase 1 en prod (correr solo con S/N).
# (recuperar creds read-only; mismo esqueleto de auth+kw usado en auditorías previas)

# 1. ¿modelos gf.rewards.* desplegados? (esperado tras deploy: existen; ANTES de deploy: NINGUNO)
kw("ir.model","search_read",[[["model","like","gf.rewards"]]],{"fields":["model"]})

# 2. módulo instalado
kw("ir.module.module","search_read",[[["name","=","gf_b2b_rewards"]]],{"fields":["name","state"]})

# 3. INERCIA — no debe haber datos de negocio:
kw("gf.rewards.accrual","search_count",[[]])        # esperado 0
kw("gf.rewards.consumption","search_count",[[]])     # esperado 0
kw("gf.rewards.ledger","search_count",[[]])          # esperado 0
kw("loyalty.card","search_count",[[]])               # esperado 0
# programa B2B real en cía 34 (esperado: NINGUNO; solo el seed "Gift Cards" de CSC GF)
kw("loyalty.program","search_read",[[["company_id","=",34]]],{"fields":["name","active"],"context":{"active_test":False}})

# 4. crons del módulo APAGADOS
kw("ir.cron","search_read",[["|",["name","ilike","reward"],["name","ilike","b2b_rewards"]]],
   {"fields":["name","active","interval_number","interval_type","nextcall"],"context":{"active_test":False}})   # active=False
# 4b. cron W14 (id 89) INTACTO (no tocado por el módulo nuevo)
kw("ir.cron","read",[[89]],{"fields":["name","active","nextcall"]})

# 5. automations del módulo APAGADAS
kw("base.automation","search_read",[[["name","ilike","reward"]]],{"fields":["name","active"],"context":{"active_test":False}})

# 6. permisos del usuario RPC de la PWA (el de ODOO_SERVICE_USER / la api key)
#    confirmar 0 write/create/unlink sobre gf.rewards.* para ese grupo (leer ir.model.access)
kw("ir.model.access","search_read",[[["model_id.model","like","gf.rewards"]]],
   {"fields":["name","group_id","perm_read","perm_write","perm_create","perm_unlink"]})
```

**Interpretación:** si los conteos §3.3 no son 0 (hay accruals/cards/programa B2B **reales**) o algún cron/automation del módulo está `active=True`, **detener y dictaminar RED** (Fase 1 debía ser inerte).

---

## 4. Plantilla de dictamen

```
DICTAMEN — Rewards B2B Fase 1 (PR <n>, rama <rama>, commit <sha>)  ·  fecha ____

RESULTADO: 🟢 GREEN técnico Fase 1  /  🟡 YELLOW (con blockers)  /  🔴 RED (inercia violada)  /  ⚪ no entregado

Bloques (A–J):  A__ B__ C__ D__ E__ F__ G__ H__ I__ J__   (✅/❌/N-A)

QUÉ ESTÁ COMPLETO:
  - ...

BLOCKERS (impiden Fase 2 — solo bloques A·B·C·D·E·G·I):
  - ...

RIESGOS:
  - ...

PENDIENTES NO BLOQUEANTES (F/H/J o menores):
  - ...

PREGUNTAS PARA SEBASTIÁN:
  - ...

RECOMENDACIÓN:  [ pasar a Fase 2 con S/N | corregir blockers y re-revisar | RED: revertir/desactivar ]
```

**Criterios de flip:**
- **🟢 GREEN técnico Fase 1:** todos los bloques bloqueantes ✅, tests verdes en dev, dry-run demostrado, y las consultas §3 confirman inercia (0 datos reales, crons/automations off).
- **🟡 YELLOW:** estructura correcta pero falta algún no-bloqueante (tests parciales, dry-run incompleto) o un bloqueante con fix menor claro.
- **🔴 RED (detener):** cualquier write activo, cron/automation `active=True`, programa/card/puntos/canje **reales**, acumulación por picking/entrega, dependencia de W14/KoldHome, o el usuario PWA con write de rewards.

---

## 5. Condiciones para mandar el PR a Codex

Mandar a Codex **solo cuando**:
1. Existe la **rama/PR de Odoo** con el módulo (no antes — hoy no hay nada que auditar).
2. El PR está **completo** (modelos + constraints + access + matriz + FIFO + ledger + dry-run + tests), no un WIP parcial.
3. **CI/tests del PR en verde** (o la suite del módulo corre 0-fail en dev/staging) — Codex audita lógica, no arregla compilación.
4. Pasó la **revisión previa de este paquete** (§1–§3) sin ❌ en bloques bloqueantes — si hay un RED de inercia, se resuelve antes de gastar la auditoría.
5. Se le da a Codex el **contexto**: este paquete + checklist doc 08 + plan v3, y los **focos** sugeridos: (a) atomicidad/locks del `gf_loyalty_redeem` (`FOR UPDATE NOWAIT` + orden determinístico + cupos sin `search_count`); (b) integridad FIFO (`remaining_points = points_total − Σconsumption`) y reversa; (c) predicado de cobro confirmado (§G-bis) y que picking NO sea trigger; (d) que la Fase 1 sea realmente inerte (crons/automations off, sin datos).
6. **Sin secretos** en el PR (mismo estándar: sin credenciales/keys en código o data).

**No mandar a Codex si:** el PR es parcial, los tests fallan, o la revisión previa detecta un RED de inercia (primero se corrige).
