# Rewards B2B — Diseño PWA v1 (read-only / coming soon)

**Estado:** DISEÑO / DOCS-ONLY. **No implementa, no despliega, no activa nada.** Destino: `docs/rewards/12_REWARDS_B2B_PWA_READONLY_DESIGN.md` (repo PWA `grupofrio/clientes-tradicional-kolders`).
**Contexto backend:** `gf_b2b_rewards` Fase 1 instalado e **inerte** (0 records en los 5 modelos, cron off, automations [], sin programa/cards/history, grupo engine con 0 usuarios, bypass de contexto cerrado). **NO** se autoriza Fase 2, acumulación, canje, ni datos reales.
**Codex:** **no entra todavía** — esto es diseño/docs-only. Codex entrará cuando exista **PR ejecutable Odoo/PWA o cualquier endpoint/código de rewards**.
**Principio rector:** **v1 no depende de Odoo.** Sale **solo con flag de front**, sin llamada real a Odoo, sin saldo, sin canje, sin prometer puntos.

---

## 0. Resumen ejecutivo

- **v1 = "Próximamente" honesto, front-only.** La PWA anuncia que habrá recompensas, **sin** prometer saldo, puntos ni canje. Se sirve **100% desde un flag de front (`NEXT_PUBLIC_REWARDS_MODE=coming_soon`)** — **sin ninguna llamada a Odoo**.
- El endpoint `POST /kold/pwa/rewards/summary` queda como **spec para v1.1**, **no** como dependencia de v1.
- Contrato JSON único con un `status` enum que dirige la UI: `coming_soon | empty | has_balance | error | unauthenticated`.
- Fases con compuerta S/N: **v1 (coming soon, front-only) → v1.1 (endpoint read-only + dry-run/simulación) → v2 (saldo real, requiere Fase 2) → v3 (canje)**.
- `redeem_enabled` = **false** hasta v3, sin excepción.

---

## 1. v1 NO depende de Odoo (front-only)

- v1 se lanza con un **flag de entorno del front**: `NEXT_PUBLIC_REWARDS_MODE=coming_soon`.
- En v1 **no hay llamada real a Odoo**: la card de `/home` y la ruta `/rewards` renderizan el estado "próximamente" **desde el flag**, sin fetch a ningún endpoint de rewards.
- Beneficio: v1 es **cosmético, auditable y reversible** (apagar = cambiar el flag), sin superficie de backend y sin riesgo de tocar datos.
- El endpoint firmado (§2) **se diseña ahora** pero **se consume hasta v1.1**.

---

## 2. Endpoint Odoo read-only propuesto — **SPEC para v1.1** (no dependencia de v1)

### Nombre
`POST /kold/pwa/rewards/summary` — consistente con la familia `/kold/pwa/*`.

### Contrato de transporte (idéntico a PC#4)
- `POST`, `type="json"`, **`auth="api_key"`** (header `API-KEY`), `csrf=False`.
- **Firma HMAC igual que PC#4:** `X-KOLD-Signature: v1=base64(HMAC_SHA256(secret, "{ts}." + rawBody))` + `X-KOLD-Timestamp`; **TTL 300s**. Reusa `_verify_signature` del controlador PC#4.
- **Solo server-side:** `API-KEY`/secret viven en la Next API route; el navegador **nunca** los ve.
- **Solo la variante firmada.** **NO** exponer variante `auth="public"` para rewards.

### Payload de entrada
```jsonc
{ "jsonrpc": "2.0", "method": "call",
  "params": { "meta": { "operation_id": "<uuid read-only>" },
              "data": { "partner_id": 12345, "channel": "b2b" } } }
```
- **`partner_id` lo resuelve el servidor de la PWA** desde la sesión autenticada (magic link W15), **nunca desde el navegador**. El controlador devuelve **solo** datos de ese partner.

### Garantías de seguridad (duras)
- **Solo lectura**: `search_read`/`read`/`search_count`. **Cero** `create`/`write`/`unlink`.
- **NO crea `loyalty.card`** si el partner no tiene ⇒ `status:"empty"`, nunca alta.
- **NO crea programa, NO crea puntos, NO canje, NO activa nada.**
- **Scoping por partner** en todas las queries (`card_id.partner_id = partner_id`).
- **Sin `sudo()` de escritura**; si lee con `sudo`, solo lectura y con el filtro de partner.
- **Flags de gobierno** (`ir.config_parameter`, solo lectura por el endpoint): `gf_b2b_rewards.pwa_enabled` (default **false**), `gf_b2b_rewards.pwa_coming_soon` (default **true**), `gf_b2b_rewards.pwa_mode ∈ {coming_soon, dry_run, real}` (default **coming_soon**).
- **Rate limit** por partner/IP.

### Matriz de respuestas
| Situación | Detección | `status` | HTTP |
|---|---|---|---|
| Rewards no activo / coming soon | `pwa_mode=coming_soon` o `pwa_enabled=false` | `coming_soon` | 200 |
| Cliente sin saldo | modo activo + partner sin accruals abiertos | `empty` | 200 |
| Cliente con saldo | modo `dry_run`/`real` + accruals>0 | `has_balance` | 200 |
| Error controlado | excepción atrapada | `error` (+`error_code`) | 200 |
| Sesión inválida | firma/timestamp/api-key inválidos | `unauthenticated` | 401/403 |

### Ownership
El endpoint es **código Odoo → lo implementa Sebas** (reusando `_verify_signature` PC#4). Este doc es el **spec**; la PWA consume desde v1.1.

---

## 3. Contrato JSON (PWA)

```jsonc
{
  "ok": true,
  "status": "coming_soon",           // coming_soon | empty | has_balance | error | unauthenticated
  "enabled": false,
  "coming_soon": true,
  "redeem_enabled": false,           // SIEMPRE false hasta v3
  "points_balance": 0,
  "money_equivalent": 0,
  "currency": "MXN",
  "point_value": 1,
  "next_expiration": null,
  "last_movements": [],
  "program_rules": [],
  "message": "Muy pronto podrás consultar tus beneficios y recompensas desde aquí.",
  "updated_at": "2026-07-08T00:00:00Z",
  "meta": { "partner_id": 12345, "contract_version": "rewards.summary.v1", "mode": "coming_soon" }
}
```
- **`status`** dirige la UI (single source of truth del front).
- **`redeem_enabled`** false en v1/v1.1/v2; true solo en v3.
- Campos de saldo (`points_balance`, `money_equivalent`, `next_expiration`, `last_movements`, `program_rules`) se **pueblan hasta v1.1+/v2**. En v1 el front **ni siquiera llama** al endpoint.

### Ejemplos por estado (los de saldo aplican a v1.1+/v2, no a v1)
```jsonc
// coming_soon (v1 / v1.1) — copy aprobado, sin promesas
{ "ok": true, "status": "coming_soon", "enabled": false, "coming_soon": true,
  "redeem_enabled": false, "points_balance": 0, "money_equivalent": 0,
  "message": "Muy pronto podrás consultar tus beneficios y recompensas desde aquí.",
  "meta": { "contract_version": "rewards.summary.v1", "mode": "coming_soon" } }

// empty (v1.1+/v2)
{ "ok": true, "status": "empty", "enabled": true, "coming_soon": false,
  "redeem_enabled": false, "points_balance": 0, "money_equivalent": 0,
  "message": "Aún no tienes beneficios registrados." }

// has_balance (v2; en v1.1 con disclaimer de simulación — ver §5)
{ "ok": true, "status": "has_balance", "enabled": true, "coming_soon": false,
  "redeem_enabled": false, "points_balance": 320, "money_equivalent": 320,
  "next_expiration": "2026-12-31",
  "last_movements": [{ "date": "2026-07-01", "type": "accrual", "points_delta": 120, "description": "Compra S22045" }] }

// error
{ "ok": false, "status": "error", "error_code": "rewards_unavailable",
  "message": "No pudimos cargar tus recompensas. Inténtalo más tarde." }

// unauthenticated (HTTP 401/403)
{ "ok": false, "status": "unauthenticated", "error_code": "invalid_session",
  "message": "Tu sesión expiró. Vuelve a entrar con tu enlace de acceso." }
```

---

## 4. Diseño PWA

### 4.1 Copy aprobado v1 (coming soon)
Usar **solo** estos textos en v1:
- Título: **"Recompensas Grupo Frío"**
- **"Muy pronto podrás consultar tus beneficios y recompensas desde aquí."**
- **"Estamos preparando un programa para premiar tus compras frecuentes."**

**Prohibido en v1** (no usar todavía): "puntos disponibles", "ya estás acumulando", "canjear", "saldo", "dinero equivalente", ni cualquier promesa de acumulación o monto.

### 4.2 Card de recompensas en `/home`
- Card **"Recompensas Grupo Frío"** con badge **"Próximamente"**, bajo el bloque de recompra.
- Copy: los textos §4.1. **Sin** números, **sin** botón de canje.
- Tap → ruta `/rewards`.

### 4.3 Ruta `/rewards`
- En v1 renderiza el estado "próximamente" **desde el flag de front** (sin fetch). Un componente `<RewardsSummary status=...>` con las 5 vistas ya previstas para v1.1+.

### 4.4 Acceso (bottom nav FUERA de v1)
- **v1:** **solo** card en `/home` + acceso desde **"Mi cuenta"** + ruta `/rewards`.
- **Bottom nav:** **NO en v1.** Se decide en **v2**, cuando haya saldo real / módulo vivo.

### 4.5 Estados visuales
| Estado | `status` | Contenido | Fase |
|---|---|---|---|
| a) Próximamente | `coming_soon` | Copy §4.1. Sin datos, sin canje. | **v1** |
| b) Sin saldo | `empty` | "Aún no tienes beneficios registrados." Sin canje. | v1.1+/v2 |
| c) Con saldo | `has_balance` | Beneficios + vencimiento + movimientos. En **v1.1** con disclaimer de simulación. Canje **oculto**. | v1.1+/v2 |
| d) Error | `error` | Mensaje amable + "Reintentar". | v1.1+ |
| e) Sesión inválida | `unauthenticated` | "Vuelve a entrar" + CTA a re-login. | v1.1+ |

### 4.6 Reglas de front
- **Nunca** botón/acción de canje si `redeem_enabled=false`.
- **v1 no llama a Odoo** (flag). Secretos/API-KEY **solo server-side** (a partir de v1.1).
- Zustand/localStorage **no** guardan datos de rewards sensibles.
- Fallar en seguro: error ⇒ estado `error`, nunca número inventado.

---

## 5. Fases sugeridas (compuerta con S/N cada una)

| Fase | Qué hace | Odoo | Datos reales |
|---|---|---|---|
| **v1** | Read-only / **coming soon**, **front-only** (flag). Card + `/rewards` en "próximamente". | **Ninguno** | **Ninguno** |
| **v1.1** | **Endpoint read-only + dry-run/simulación** por cliente (usa `dry_run_payment_accrual`, **sin escribir** accruals). UI con disclaimer. | Endpoint read-only + engine dry-run (sin writes) | **Ninguno persistido** |
| **v2** | **Saldo real** (lee `gf.rewards.accrual`/`ledger`). | Endpoint lee libro real | Requiere **Fase 2** |
| **v3** | **Canje** (`redeem_enabled=true`, engine redeem atómico). | Endpoint write (grupo service) | Canjes reales |

### Copy obligatorio de v1.1 (si se muestra saldo simulado)
> **"Simulación informativa. No representa saldo disponible para canje."**

v1 y v1.1 **no** requieren activar Fase 2 (v1 cosmético; v1.1 cálculo efímero dry-run sin persistencia).

---

## 6. Dependencias técnicas

- **Odoo (lo implementa Sebas — spec aquí):** ruta read-only `POST /kold/pwa/rewards/summary` (reusa `_verify_signature` PC#4) + 3 `ir.config_parameter`. **Sin modelos nuevos** para v1/v1.1. **Nada en v1** (v1 no llama a Odoo).
- **PWA (nuestro lado):** v1 → flag `NEXT_PUBLIC_REWARDS_MODE`, card en `/home`, ruta `/rewards`, componente `<RewardsSummary>`. v1.1 → `src/lib/odooRewardsApi.ts` (cliente firmado server-side, gemelo de `odooPwaApi.ts`) + route `src/app/api/rewards/summary/route.ts` (deriva partner_id de la sesión).
- **Tests:** v1 → componente en estado coming_soon + que **no** hace fetch a Odoo. v1.1+ → contract del endpoint (firma válida/inválida, scoping por partner, read-only, sin card ⇒ empty), 5 estados de UI, snapshot del JSON, test negativo de firma.
- **Seguridad:** HMAC + api_key + TTL 300s; secretos server-only; scoping por partner server-side; rate limit; solo lectura; sin variante pública.
- **Datos:** v1 **ninguno**; v1.1 **ninguno persistido** (dry-run efímero); v2 requiere Fase 2; v3 canjes.

---

## 7. NO hacer todavía (explícito)

- ❌ **Fase 2**
- ❌ **Programa B2B** activo
- ❌ **loyalty.cards**
- ❌ **puntos reales**
- ❌ **accruals**
- ❌ **consumption**
- ❌ **ledger**
- ❌ **quotas reales**
- ❌ **point.rules reales**
- ❌ **n8n**
- ❌ **WhatsApp**
- ❌ **cron / automations**
- ❌ **canje** (redeem_enabled=false hasta v3)
- ❌ **endpoint público** o con cualquier **write**
- ❌ alta de `loyalty.card` desde el endpoint
- ❌ **deploy / merge / PR ejecutable sin S/N**
- ❌ **Codex** (entra solo cuando exista PR ejecutable Odoo/PWA o código/endpoint de rewards)

---

## 8. Siguiente paso (cuando lo autorices)
Este documento ya está versionado en **PR #19 (docs-only, draft)**. Pasos:

1. **Con S/N: mergear PR #19** (docs-only) — este documento.
2. **Con S/N separado: arrancar PR PWA de v1 coming soon** — auditable y reversible:
   - `NEXT_PUBLIC_REWARDS_MODE=coming_soon`
   - card en `/home`
   - ruta `/rewards`
   - **cero Odoo**
   - **cero endpoint**
   - **cero saldo**
   - **cero canje**
3. **En paralelo:** pasar el **spec del endpoint** (`POST /kold/pwa/rewards/summary`) a Sebas para v1.1.
