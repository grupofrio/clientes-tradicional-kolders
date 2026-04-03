import { NextResponse } from 'next/server';
import { verifyToken, signToken, hashOtp } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
    try {
        const { code } = await request.json();
        if (!code || typeof code !== 'string' || code.length !== 6) {
            return NextResponse.json({ error: 'Código inválido. Debe ser de 6 dígitos.' }, { status: 400 });
        }

        const cookieStore = await cookies();
        const otpSession = cookieStore.get('otp_session')?.value;

        if (!otpSession) {
            return NextResponse.json({ error: 'La sesión expiró. Vuelve a solicitar un código nuevo.' }, { status: 401 });
        }

        const payload = await verifyToken(otpSession);
        if (!payload || !payload.partner_id || !payload.b2b || !payload.otp_hash) {
            return NextResponse.json({ error: 'Sesión inválida. Solicita un código nuevo.' }, { status: 401 });
        }

        // Verificar código hasheado — no se puede extraer del JWT
        const submittedHash = hashOtp(code);
        if (payload.otp_hash !== submittedHash) {
            return NextResponse.json({ error: 'Código incorrecto. Verifica el mensaje de WhatsApp.' }, { status: 401 });
        }

        // Código correcto: Crear sesión válida de 7 días
        const sessionToken = await signToken({ partner_id: payload.partner_id, b2b: true, source: 'pwa_canal_tradicional' });

        cookieStore.set('session', sessionToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7 // 7 days
        });

        // Borrar la cookie temporal de OTP
        cookieStore.delete('otp_session');

        return NextResponse.json({ success: true, redirect: '/catalog' });

    } catch (error: any) {
        console.error('Verify Code Error:', error);
        return NextResponse.json({ error: 'Error del servidor. Intenta nuevamente.' }, { status: 500 });
    }
}

export const dynamic = 'force-dynamic';
