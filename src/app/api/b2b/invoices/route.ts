import { NextResponse } from 'next/server';
import { callKw } from '@/lib/odoo';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session')?.value;
    if (!sessionCookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await verifyToken(sessionCookie);
    if (!payload?.partner_id || !payload.b2b) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const invoices = await callKw('account.move', 'search_read', [
       [
           ['partner_id', '=', payload.partner_id],
           ['move_type', '=', 'out_invoice'],
           ['payment_state', 'in', ['not_paid', 'partial']],
           ['state', '=', 'posted']
       ]
    ], {
       fields: ['name', 'amount_total', 'amount_residual', 'invoice_date', 'invoice_date_due', 'payment_state'],
       order: 'invoice_date_due asc',
       limit: 30
    });

    return NextResponse.json(invoices);

  } catch (error) {
    console.error('Invoices API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
