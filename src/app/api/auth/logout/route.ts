import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete('session');
    cookieStore.delete('otp_session');
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Error cerrando sesión' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
