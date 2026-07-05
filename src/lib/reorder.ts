import type { B2BCartItem } from "@/store/cart";

export interface ReorderResult {
  added: number;
  omitted: string[];
}

interface ReorderableOrder {
  lines?: Array<{ product_id: number; name: string; qty: number }>;
}

/**
 * Rehidrata las líneas de un pedido anterior desde el catálogo ACTUAL
 * (precio, SKU, tax_rate y empaque vigentes) en lugar de copiar datos
 * históricos. Productos que ya no existen o no están disponibles se
 * omiten y se devuelven en `omitted` para avisar al cliente — nunca se
 * agregan líneas rotas al carrito. Usado por Inicio y por Mis pedidos.
 */
export async function rehydrateReorder(
  order: ReorderableOrder,
  addItem: (item: B2BCartItem) => void,
): Promise<ReorderResult> {
  const res = await fetch("/api/catalog");
  if (!res.ok) throw new Error("catalog");
  const catalog = await res.json();
  if (!Array.isArray(catalog)) throw new Error("catalog");

  const byId = new Map<number, (typeof catalog)[number]>(
    catalog.map((c: { id: number }) => [c.id, c]),
  );
  const omitted: string[] = [];
  let added = 0;

  (order.lines || []).forEach((line) => {
    const item = byId.get(line.product_id);
    if (!item) {
      omitted.push(line.name.split("\n")[0]);
      return;
    }
    addItem({
      product_id: item.id,
      name: item.name,
      sku: item.sku || "",
      price: item.price,
      tax_rate: item.tax_rate || 0,
      uom_name: item.uom,
      qty: line.qty,
      qtyPerPage: item.boxSize || 1,
    });
    added++;
  });

  return { added, omitted };
}
