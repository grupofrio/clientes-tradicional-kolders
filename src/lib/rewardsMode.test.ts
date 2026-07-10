import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getRewardsMode, isRewardsVisibleV1 } from "./rewardsMode.ts";

const HERE = import.meta.dirname;
const read = (...p: string[]) => readFileSync(join(HERE, ...p), "utf8");

// Escanea SOLO el código (quita comentarios) para no dar falsos positivos con
// comentarios descriptivos que mencionan términos prohibidos a propósito.
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const REWARDS_SUMMARY = read("..", "components", "RewardsSummary.tsx");
const REWARDS_PAGE = read("..", "app", "(protected)", "rewards", "page.tsx");
const HOME = read("..", "app", "(protected)", "home", "page.tsx");
const ACCOUNT = read("..", "app", "(protected)", "account", "page.tsx");
const BOTTOM_NAV = read("..", "components", "BottomNav.tsx");

const RENDER_FILES: Array<[string, string]> = [
  ["RewardsSummary.tsx", REWARDS_SUMMARY],
  ["rewards/page.tsx", REWARDS_PAGE],
];

describe("rewardsMode — flag NEXT_PUBLIC_REWARDS_MODE", () => {
  it("unset y coming_soon => visible", () => {
    assert.equal(getRewardsMode(undefined), "coming_soon");
    assert.equal(getRewardsMode(""), "coming_soon");
    assert.equal(getRewardsMode("coming_soon"), "coming_soon");
    assert.equal(getRewardsMode("  COMING_SOON  "), "coming_soon");
    assert.equal(isRewardsVisibleV1(undefined), true);
    assert.equal(isRewardsVisibleV1("coming_soon"), true);
  });

  it("off => oculto", () => {
    assert.equal(getRewardsMode("off"), "off");
    assert.equal(isRewardsVisibleV1("off"), false);
  });

  it("valor desconocido => off (fail-safe)", () => {
    assert.equal(getRewardsMode("banana"), "off");
    assert.equal(getRewardsMode("enabled"), "off");
    assert.equal(isRewardsVisibleV1("banana"), false);
  });

  it("dry_run y real: reservados, NO activan nada en v1 (ocultos)", () => {
    assert.equal(getRewardsMode("dry_run"), "dry_run");
    assert.equal(getRewardsMode("real"), "real");
    assert.equal(isRewardsVisibleV1("dry_run"), false);
    assert.equal(isRewardsVisibleV1("real"), false);
  });
});

describe("rewards v1 — guardia estática: cero Odoo/endpoint/fetch", () => {
  for (const [name, src] of RENDER_FILES) {
    it(`${name} no hace fetch ni llama a Odoo/endpoint/API`, () => {
      const code = stripComments(src);
      assert.ok(!/\bfetch\s*\(/.test(code), `${name} contiene fetch(`);
      assert.ok(!code.includes("/api"), `${name} referencia /api`);
      assert.ok(!/odoo/i.test(code), `${name} referencia odoo`);
      assert.ok(!code.includes("/kold"), `${name} referencia /kold`);
      assert.ok(!/https?:\/\//.test(code), `${name} contiene URL http`);
      assert.ok(!/odooPwaApi|odooRewardsApi/.test(code), `${name} importa cliente Odoo`);
    });
  }
});

describe("rewards v1 — guardia estática: cero saldo/puntos/canje", () => {
  const FORBIDDEN = [
    "saldo", "puntos", "puntos disponibles", "ya estás acumulando",
    "canjear", "canje", "dinero equivalente", "money_equivalent",
    "points_balance", "redeem",
  ];
  for (const [name, src] of RENDER_FILES) {
    it(`${name} no contiene términos prohibidos`, () => {
      const code = stripComments(src).toLowerCase();
      for (const term of FORBIDDEN) {
        assert.ok(!code.includes(term.toLowerCase()), `${name} contiene término prohibido: "${term}"`);
      }
    });
  }
});

describe("rewards v1 — copy aprobado", () => {
  it("RewardsSummary contiene los 3 textos aprobados y el badge", () => {
    assert.ok(REWARDS_SUMMARY.includes("Recompensas Grupo Frío"));
    assert.ok(REWARDS_SUMMARY.includes("Muy pronto podrás consultar tus beneficios y recompensas desde aquí."));
    assert.ok(REWARDS_SUMMARY.includes("Estamos preparando un programa para premiar tus compras frecuentes."));
    assert.ok(REWARDS_SUMMARY.includes("Próximamente"));
  });
});

describe("rewards v1 — /home: teaser viejo reemplazado", () => {
  it("el teaser off-message ya no está y usa el componente gateado", () => {
    assert.ok(!HOME.includes("sumarán puntos"), "/home aún tiene el teaser viejo");
    assert.ok(!HOME.includes("Estamos preparando beneficios para clientes frecuentes"), "/home aún tiene copy viejo");
    assert.ok(HOME.includes("RewardsSummary"), "/home no monta RewardsSummary");
    assert.ok(HOME.includes("rewardsVisibleV1"), "/home no gatea por flag");
  });
});

describe("rewards v1 — acceso desde Mi cuenta y NADA en bottom nav", () => {
  it("account enlaza a /rewards, gateado", () => {
    assert.ok(ACCOUNT.includes('href="/rewards"'), "account no enlaza a /rewards");
    assert.ok(ACCOUNT.includes("rewardsVisibleV1"), "account no gatea el link");
  });
  it("BottomNav NO contiene /rewards ni Recompensas", () => {
    assert.ok(!BOTTOM_NAV.includes("/rewards"), "BottomNav referencia /rewards");
    assert.ok(!/recompensas/i.test(BOTTOM_NAV), "BottomNav menciona Recompensas");
  });
});
