import { NextResponse } from 'next/server';
import { callKw } from '@/lib/odoo';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  try {
    const sessionCookie = (await cookies()).get('session')?.value;
    if (!sessionCookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await verifyToken(sessionCookie);
    if (!payload?.partner_id || !payload?.b2b) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const url = new URL(request.url);
    const categoryName = url.searchParams.get('category');

    // Traer productos publicables directamente desde product.product
    // Esto nos da el ID correcto para sale.order.line Y lst_price con la pricelist aplicada
    let domain: any[] = [['sale_ok', '=', true], ['is_published', '=', true], ['qty_available', '>', 0]];

    if (categoryName && categoryName !== 'Todas') {
      domain.push(['public_categ_ids.name', '=', categoryName]);
    }

    const items = await callKw('product.product', 'search_read', [domain], {
      fields: ['id', 'name', 'default_code', 'uom_id', 'packaging_ids', 'qty_available', 'sale_line_warn_msg', 'lst_price', 'list_price'],
      limit: 100
    });

    // Resolver packaging en batch para los que tengan
    const packagingIds = items.flatMap((item: any) => item.packaging_ids || []);
    let packagingMap: Record<number, number> = {};
    if (packagingIds.length > 0) {
      const packs = await callKw('product.packaging', 'search_read', [[['id', 'in', packagingIds]]], {
        fields: ['id', 'qty', 'product_id']
      });
      for (const p of packs) {
        if (p.product_id) packagingMap[p.product_id[0]] = p.qty;
      }
    }

    const catalogItems = items.map((item: any) => ({
      id: item.id,  // product.product ID — correcto para sale.order.line
      name: item.name,
      sku: item.default_code || null,
      price: item.lst_price || item.list_price || 0,
      uom: item.uom_id ? item.uom_id[1] : 'pza',
      boxSize: packagingMap[item.id] || 1,
      stock: item.qty_available,
      warning: item.sale_line_warn_msg
    }));

    return NextResponse.json(catalogItems);

  } catch (error) {
    console.error('Catalog API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
