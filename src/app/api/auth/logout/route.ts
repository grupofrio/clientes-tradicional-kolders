import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySameOrigin } from '@/lib/requestGuards';

export async function POST(request: Request) {
  try {
    if (!verifySameOrigin(request)) {
      return NextResponse.json({ error: 'Solicitud no permitida.' }, { status: 403 });
    }
    const cookieStore = await cookies();
    cookieStore.delete('session');
    cookieStore.delete('otp_session');
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Error cerrando sesión' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
