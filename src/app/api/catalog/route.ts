import { NextResponse } from 'next/server';
import { callKw } from '@/lib/odoo';
import { verifyToken } from '@/lib/auth';
import { resolvePricesForPartner } from '@/lib/pricelist';
import { cookies } from 'next/headers';

/**
 * Mapeo comercial de categ_id (categoría interna de Odoo) a familia + subgrupo.
 * Basado en la estructura real: PRODUCTO TERMINADO / {tipo} / {subtipo} / {marca}
 *
 * Reglas de negocio Canal Tradicional:
 *  - Si la ruta contiene "LAURITA" → familia LAURITA
 *  - Si la ruta contiene "GENERI" (GENERICA/GENERICO) → familia LAURITA (barras/molido sin marca)
 *  - Si la ruta contiene "KOLD" → familia KOLD
 *  - Resto → familia OTROS
 */
function classifyProduct(categPath: string): { family_key: string; family_label: string; subgroup_key: string; subgroup_label: string; sort_order: number } {
  const path = (categPath || '').toUpperCase();

  // --- LAURITA ---
  if (path.includes('LAURITA')) {
    if (path.includes('ROLITO')) return { family_key: 'LAURITA', family_label: 'Laurita', subgroup_key: 'ROLITO', subgroup_label: 'Bolsa de Hielo Rolito', sort_order: 10 };
    return { family_key: 'LAURITA', family_label: 'Laurita', subgroup_key: 'OTROS', subgroup_label: 'Otros Laurita', sort_order: 19 };
  }

  // --- GENÉRICA (barras, molido) → comercialmente Laurita ---
  if (path.includes('GENERI') || (path.includes('BARRA') && !path.includes('KOLD'))) {
    if (path.includes('BARRA')) return { family_key: 'LAURITA', family_label: 'Laurita', subgroup_key: 'BARRAS', subgroup_label: 'Barras de Hielo', sort_order: 11 };
    if (path.includes('MOLIDO')) return { family_key: 'LAURITA', family_label: 'Laurita', subgroup_key: 'MOLIDO', subgroup_label: 'Hielo Molido', sort_order: 12 };
    return { family_key: 'LAURITA', family_label: 'Laurita', subgroup_key: 'OTROS', subgroup_label: 'Otros Hielo', sort_order: 19 };
  }

  if (path.includes('MOLIDO') && !path.includes('KOLD')) {
    return { family_key: 'LAURITA', family_label: 'Laurita', subgroup_key: 'MOLIDO', subgroup_label: 'Hielo Molido', sort_order: 12 };
  }

  // --- KOLD ---
  if (path.includes('KOLD') || path.includes('CUP') || path.includes('SMUTHIE') || path.includes('SORBET') || path.includes('SNACK')) {
    if (path.includes('CUP')) return { family_key: 'KOLD', family_label: 'Kold', subgroup_key: 'CUP', subgroup_label: 'Kold Cup', sort_order: 20 };
    if (path.includes('SMUTHIE')) return { family_key: 'KOLD', family_label: 'Kold', subgroup_key: 'SMUTHIE', subgroup_label: 'Kold Smoothie', sort_order: 21 };
    if (path.includes('SORBET')) return { family_key: 'KOLD', family_label: 'Kold', subgroup_key: 'SORBET', subgroup_label: 'Kold Sorbet', sort_order: 22 };
    if (path.includes('SNACK') || path.includes('FRUIT')) return { family_key: 'KOLD', family_label: 'Kold', subgroup_key: 'SNACK', subgroup_label: 'Kold Snack & Fruits', sort_order: 23 };
    if (path.includes('ROLITO') || path.includes('HIELO')) return { family_key: 'KOLD', family_label: 'Kold', subgroup_key: 'HIELO', subgroup_label: 'Hielo Kold', sort_order: 24 };
    return { family_key: 'KOLD', family_label: 'Kold', subgroup_key: 'OTROS', subgroup_label: 'Otros Kold', sort_order: 29 };
  }

  // --- OTROS ---
  return { family_key: 'OTROS', family_label: 'Otros', subgroup_key: 'GENERAL', subgroup_label: 'General', sort_order: 90 };
}

export async function GET() {
  try {
    const sessionCookie = (await cookies()).get('session')?.value;
    if (!sessionCookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await verifyToken(sessionCookie);
    if (!payload?.partner_id || !payload?.b2b) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    // Canal Tradicional: traer TODOS los productos vendibles con stock
    // No filtrar por is_published — el catálogo B2B incluye barras/molido no publicados en web
    const domain: any[] = [['sale_ok', '=', true], ['qty_available', '>', 0]];

    const items = await callKw('product.product', 'search_read', [domain], {
      fields: ['id', 'name', 'default_code', 'categ_id', 'uom_id', 'packaging_ids', 'qty_available', 'sale_line_warn_msg', 'lst_price', 'list_price'],
      limit: 200
    });

    // Filtrar solo PRODUCTO TERMINADO (excluir materias primas, insumos, etc.)
    const ptItems = items.filter((item: any) => {
      const categ = item.categ_id ? item.categ_id[1] : '';
      return categ.toUpperCase().startsWith('PRODUCTO TERMINADO');
    });

    // Resolver packaging en batch
    const packagingIds = ptItems.flatMap((item: any) => item.packaging_ids || []);
    let packagingMap: Record<number, number> = {};
    if (packagingIds.length > 0) {
      const packs = await callKw('product.packaging', 'search_read', [[['id', 'in', packagingIds]]], {
        fields: ['id', 'qty', 'product_id']
      });
      for (const p of packs) {
        if (p.product_id) packagingMap[p.product_id[0]] = p.qty;
      }
    }

    // Obtener rutas completas de categorías para clasificación precisa
    const categIds = [...new Set(ptItems.map((item: any) => item.categ_id?.[0]).filter(Boolean))];
    let categPathMap: Record<number, string> = {};
    if (categIds.length > 0) {
      const cats = await callKw('product.category', 'search_read', [[['id', 'in', categIds]]], {
        fields: ['id', 'complete_name']
      });
      for (const c of cats) {
        categPathMap[c.id] = c.complete_name;
      }
    }

    // ── P0 FIX: aplicar pricelist del partner antes de devolver precios ──
    // Antes: catalog devolvía `lst_price` crudo, que ignora overrides de pricelist.
    // Ej. en pl=1 (Predeterminado MXN), product.id=86 tiene lst_price=$6 PERO el
    // item del pricelist lo fija en $10. El cobro real al confirmar sería $10.
    // Mostrar el precio correcto evita sorpresas en checkout y discrepancias con
    // sale.order.line.price_unit (que Odoo computa con el mismo pricelist).
    const productIdsForPricing: number[] = ptItems.map((it: { id: number }) => it.id);
    let pricelistMap: Record<number, { price: number; base: number; appliedItemId: number | null; rule: string }> = {};
    try {
      pricelistMap = await resolvePricesForPartner(Number(payload.partner_id), productIdsForPricing);
    } catch (priceErr) {
      console.warn('[B2B_PRICING] resolver failed, falling back to lst_price', priceErr);
      // Fallback defensivo: usar lst_price si el resolver explota — preferimos
      // devolver catálogo "viejo" antes que romper la UI.
      for (const item of ptItems) {
        const base = item.lst_price || item.list_price || 0;
        pricelistMap[item.id] = { price: base, base, appliedItemId: null, rule: 'fallback_lst_price' };
      }
    }

    const catalogItems = ptItems.map((item: any) => {
      const categId = item.categ_id?.[0] || 0;
      const categPath = categPathMap[categId] || item.categ_id?.[1] || '';
      const classification = classifyProduct(categPath);
      const resolved = pricelistMap[item.id];
      const finalPrice = resolved ? resolved.price : (item.lst_price || item.list_price || 0);

      return {
        id: item.id,
        name: item.name,
        sku: item.default_code || null,
        price: Math.round(finalPrice * 100) / 100,
        // base/list_price informativo — útil para mostrar tachado si hay descuento
        list_price: Math.round((item.lst_price || item.list_price || 0) * 100) / 100,
        pricing_rule: resolved?.rule || 'list_price',
        uom: item.uom_id ? item.uom_id[1] : 'pza',
        boxSize: packagingMap[item.id] || 1,
        stock: item.qty_available,
        warning: item.sale_line_warn_msg,
        family_key: classification.family_key,
        family_label: classification.family_label,
        subgroup_key: classification.subgroup_key,
        subgroup_label: classification.subgroup_label,
        sort_order: classification.sort_order,
      };
    });

    console.info('[B2B_PRICING] catalog resolved', {
      partner_id: payload.partner_id,
      products: catalogItems.length,
      pricelist_rules_applied: catalogItems.filter((c: any) => c.pricing_rule !== 'list_price' && c.pricing_rule !== 'no_pricelist' && c.pricing_rule !== 'fallback_lst_price').length,
    });

    // Extraer peso en KG del nombre para ordenar productos por tamaño
    function extractWeight(name: string): number {
      const match = name.match(/\((\d+(?:\.\d+)?)\s*KG\)/i);
      return match ? parseFloat(match[1]) : 999;
    }

    // Ordenar: familia → subgrupo → peso (menor a mayor) → nombre
    catalogItems.sort((a: any, b: any) => {
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      const wa = extractWeight(a.name);
      const wb = extractWeight(b.name);
      if (wa !== wb) return wa - wb;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json(catalogItems);

  } catch (error) {
    console.error('Catalog API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
