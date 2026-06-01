/**
 * KOLD B2B — Pricelist resolver
 *
 * Odoo 18 marca como "private" (vía `_get_product_price`) los métodos que
 * calculan precio según pricelist, así que no podemos llamarlos por RPC.
 * Replicamos la lógica server-side leyendo `product.pricelist.item`.
 *
 * Cobertura:
 *   - compute_price = 'fixed'      → fixed_price
 *   - compute_price = 'percentage' → base * (1 - percent_price/100)
 *   - compute_price = 'formula'    → base * (1 - price_discount/100) + price_surcharge
 *   - applied_on    = '0_product_variant' | '1_product' | '2_product_category' | '3_global'
 *   - min_quantity, date_start, date_end
 *   - specificity prioritaria: variant > template > categoría > global
 *
 * NO cubre (aceptado como fallback al precio Odoo en create):
 *   - base distinto de list_price (e.g., base = pricelist_id, otra moneda)
 *   - min/max margin
 *   - price_round
 *   - currencies distintas a MXN
 *
 * Si alguna línea cae fuera de la cobertura, el flujo de creación de pedido
 * confía en Odoo: pasamos pricelist_id y NO pasamos price_unit, dejando que
 * Odoo aplique su propio _compute_price_unit en sale.order.line.
 */

import { callKw } from "./odoo";

export type PricelistItem = {
  id: number;
  applied_on: "0_product_variant" | "1_product" | "2_product_category" | "3_global";
  product_id: [number, string] | false;
  product_tmpl_id: [number, string] | false;
  categ_id: [number, string] | false;
  compute_price: "fixed" | "percentage" | "formula";
  fixed_price: number;
  percent_price: number;
  price_discount: number;
  price_surcharge: number;
  min_quantity: number;
  date_start: string | false;
  date_end: string | false;
};

export type ProductForPricing = {
  id: number;
  product_tmpl_id: number;
  categ_id: number | null;
  list_price: number;
  lst_price: number;
};

/**
 * Lee todos los items activos del pricelist desde Odoo.
 * Cache fuera de scope — el caller decide caching.
 */
export async function fetchPricelistItems(pricelistId: number): Promise<PricelistItem[]> {
  return callKw("product.pricelist.item", "search_read", [[["pricelist_id", "=", pricelistId]]], {
    fields: [
      "id",
      "applied_on",
      "product_id",
      "product_tmpl_id",
      "categ_id",
      "compute_price",
      "fixed_price",
      "percent_price",
      "price_discount",
      "price_surcharge",
      "min_quantity",
      "date_start",
      "date_end",
    ],
  });
}

/**
 * Devuelve la cadena de IDs de categoría desde el producto hacia la raíz.
 * Para soportar applied_on='2_product_category' con herencia.
 */
async function buildCategoryAncestry(categIds: number[]): Promise<Record<number, number[]>> {
  if (categIds.length === 0) return {};
  const ancestry: Record<number, number[]> = {};
  // Read parent chain
  let toLookup = [...new Set(categIds)];
  const cache: Record<number, number | null> = {};
  while (toLookup.length > 0) {
    const cats = await callKw("product.category", "read", [toLookup], {
      fields: ["id", "parent_id"],
    });
    const next: number[] = [];
    for (const c of cats) {
      const parent = Array.isArray(c.parent_id) ? c.parent_id[0] : null;
      cache[c.id] = parent;
      if (parent && !(parent in cache)) next.push(parent);
    }
    toLookup = next;
  }
  // Build chain per starting id
  for (const start of categIds) {
    const chain: number[] = [];
    let cur: number | null = start;
    while (cur && cache[cur] !== undefined) {
      chain.push(cur);
      cur = cache[cur];
      if (chain.length > 32) break; // safety
    }
    ancestry[start] = chain;
  }
  return ancestry;
}

/**
 * Pre-clasifica items por applied_on para búsquedas O(1).
 */
function indexItems(items: PricelistItem[]) {
  const byProduct = new Map<number, PricelistItem[]>();
  const byTemplate = new Map<number, PricelistItem[]>();
  const byCategory = new Map<number, PricelistItem[]>();
  const global: PricelistItem[] = [];
  for (const it of items) {
    if (it.applied_on === "0_product_variant" && it.product_id) {
      const id = it.product_id[0];
      if (!byProduct.has(id)) byProduct.set(id, []);
      byProduct.get(id)!.push(it);
    } else if (it.applied_on === "1_product" && it.product_tmpl_id) {
      const id = it.product_tmpl_id[0];
      if (!byTemplate.has(id)) byTemplate.set(id, []);
      byTemplate.get(id)!.push(it);
    } else if (it.applied_on === "2_product_category" && it.categ_id) {
      const id = it.categ_id[0];
      if (!byCategory.has(id)) byCategory.set(id, []);
      byCategory.get(id)!.push(it);
    } else if (it.applied_on === "3_global") {
      global.push(it);
    }
  }
  return { byProduct, byTemplate, byCategory, global };
}

function isItemActiveNow(it: PricelistItem, today: string): boolean {
  if (it.date_start && it.date_start > today) return false;
  if (it.date_end && it.date_end < today) return false;
  return true;
}

function applyRule(it: PricelistItem, basePrice: number): number {
  switch (it.compute_price) {
    case "fixed":
      return it.fixed_price;
    case "percentage":
      return Math.max(0, basePrice * (1 - (it.percent_price || 0) / 100));
    case "formula":
      return Math.max(
        0,
        basePrice * (1 - (it.price_discount || 0) / 100) + (it.price_surcharge || 0)
      );
    default:
      return basePrice;
  }
}

/**
 * Computa el precio final del producto aplicando el pricelist.
 * Selecciona la regla más específica que matchee (variant > template > categ > global).
 * Si ninguna regla aplica, devuelve el precio base (list_price/lst_price).
 */
export function computeProductPrice(
  product: ProductForPricing,
  qty: number,
  index: ReturnType<typeof indexItems>,
  categoryAncestry: Record<number, number[]>,
  today: string
): { price: number; appliedItemId: number | null; rule: string } {
  const base = product.lst_price || product.list_price || 0;
  const candidatesOrdered: PricelistItem[][] = [
    index.byProduct.get(product.id) || [],
    index.byTemplate.get(product.product_tmpl_id) || [],
  ];
  // Category — walk ancestry from most-specific
  if (product.categ_id !== null) {
    const chain = categoryAncestry[product.categ_id] || [product.categ_id];
    for (const catId of chain) {
      candidatesOrdered.push(index.byCategory.get(catId) || []);
    }
  }
  candidatesOrdered.push(index.global);

  for (const group of candidatesOrdered) {
    const active = group.filter(
      (it) => isItemActiveNow(it, today) && qty >= (it.min_quantity || 0)
    );
    if (active.length === 0) continue;
    // Choose the first that matches (Odoo's order is by id by default; we trust input order)
    const rule = active[0];
    return {
      price: applyRule(rule, base),
      appliedItemId: rule.id,
      rule: `${rule.applied_on}/${rule.compute_price}`,
    };
  }

  return { price: base, appliedItemId: null, rule: "list_price" };
}

/**
 * Resuelve el precio para un conjunto de productos según el pricelist asignado al partner.
 * Si el partner no tiene pricelist, devuelve `lst_price` directo.
 *
 * @param partnerId   res.partner.id
 * @param productIds  IDs a tarifar
 * @returns Map<product_id, {price, base, appliedItemId, rule}>
 */
export async function resolvePricesForPartner(
  partnerId: number,
  productIds: number[]
): Promise<Record<number, { price: number; base: number; appliedItemId: number | null; rule: string }>> {
  if (productIds.length === 0) return {};

  // 1. Leer partner para obtener pricelist
  const partners = await callKw("res.partner", "read", [[partnerId]], {
    fields: ["id", "property_product_pricelist"],
  });
  if (!partners.length) throw new Error("partner_not_found");
  const pl = partners[0].property_product_pricelist;
  const pricelistId = Array.isArray(pl) ? pl[0] : null;

  // 2. Leer productos
  const products = await callKw("product.product", "read", [productIds], {
    fields: ["id", "name", "product_tmpl_id", "categ_id", "lst_price", "list_price"],
  });
  const productMap: Record<number, ProductForPricing> = {};
  for (const p of products) {
    productMap[p.id] = {
      id: p.id,
      product_tmpl_id: Array.isArray(p.product_tmpl_id) ? p.product_tmpl_id[0] : 0,
      categ_id: Array.isArray(p.categ_id) ? p.categ_id[0] : null,
      list_price: p.list_price || 0,
      lst_price: p.lst_price || 0,
    };
  }

  // 3. Sin pricelist → lst_price directo
  if (!pricelistId) {
    const out: Record<number, any> = {};
    for (const pid of productIds) {
      const prod = productMap[pid];
      const base = prod ? prod.lst_price || prod.list_price : 0;
      out[pid] = { price: base, base, appliedItemId: null, rule: "no_pricelist" };
    }
    return out;
  }

  // 4. Pricelist con items
  const items = await fetchPricelistItems(pricelistId);
  const index = indexItems(items);

  // 5. Ancestry de categorías para 2_product_category
  const categIds = Object.values(productMap)
    .map((p) => p.categ_id)
    .filter((x): x is number => x !== null);
  const ancestry = await buildCategoryAncestry(categIds);

  // 6. Computar
  const today = new Date().toISOString().slice(0, 10);
  const out: Record<number, any> = {};
  for (const pid of productIds) {
    const prod = productMap[pid];
    if (!prod) {
      out[pid] = { price: 0, base: 0, appliedItemId: null, rule: "product_not_found" };
      continue;
    }
    const { price, appliedItemId, rule } = computeProductPrice(prod, 1, index, ancestry, today);
    out[pid] = {
      price: Math.round(price * 100) / 100,
      base: prod.lst_price || prod.list_price,
      appliedItemId,
      rule,
    };
  }
  return out;
}

/**
 * Devuelve el pricelist_id asignado al partner (o null si no tiene).
 * Útil para pasarlo explícito al sale.order.create.
 */
export async function getPartnerPricelistId(partnerId: number): Promise<number | null> {
  const partners = await callKw("res.partner", "read", [[partnerId]], {
    fields: ["property_product_pricelist"],
  });
  if (!partners.length) return null;
  const pl = partners[0].property_product_pricelist;
  return Array.isArray(pl) ? pl[0] : null;
}
