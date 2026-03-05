import { NextResponse } from 'next/server';
import { callKw } from '@/lib/odoo';
import { signToken } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { phone } = await request.json();
    if (!phone) {
      return NextResponse.json({ error: 'Número no válido' }, { status: 400 });
    }

    // Limpiar formato a internacional
    let formattedPhone = phone.replace(/\D/g, '');
    let localPhone = formattedPhone.slice(-10); // Los ultimos 10 digitos siempre
    let mxPhone = `52${localPhone}`;
    let mx1Phone = `521${localPhone}`;

    // Al formatearlo para N8N:
    formattedPhone = mxPhone; // n8n prefiere 52XXXXXXXXXX normalmente

    // Buscar el partner en Odoo con diferentes combinaciones posibles
    // Si Odoo tiene "+52 33 3642 7520" o "443 693 0710", ilike necesita comodines %
    // Creamos un patrÃ³n que intercale '%' entre cada dÃ­gito local para ignorar espacios y guiones
    const likePattern = `%${localPhone.split('').join('%')}%`;

    const searchDomain = [
      '|', '|', '|',
      ['mobile', 'ilike', likePattern],
      ['phone', 'ilike', likePattern],
      ['mobile', 'ilike', localPhone],
      ['phone', 'ilike', localPhone]
    ];

    const partners = await callKw(
      'res.partner',
      'search_read',
      [searchDomain],
      { fields: ['id', 'name', 'mobile', 'customer_rank', 'company_type', 'property_product_pricelist', 'property_payment_term_id', 'credit_limit', 'credit'], limit: 1 }
    );

    let partner = partners[0];

    // ValidaciÃ³n B2B Exclusiva
    if (partner) {
      if (partner.company_type !== "company") {
        return NextResponse.json({
          error: 'Solo las cuentas empresariales o de distribución pueden acceder al portal B2B.',
          b2b_locked: true
        }, { status: 403 });
      }
    } else {
      return NextResponse.json({
        error: 'Número no registrado. Si eres distribuidor, contacta a ventas KOLD.',
        b2b_locked: true
      }, { status: 404 });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const loginToken = await signToken({ partner_id: partner.id, b2b: true, phone: formattedPhone, otp: otpCode });
    const magicLink = `${process.env.NEXT_PUBLIC_APP_URL}/auth?token=${loginToken}`;

    // Enviar a N8N - Mismo mecanismo W03 KoldHome (Magic Link)
    const n8nUrl = process.env.N8N_WEBHOOK_URL_B2B || process.env.N8N_WEBHOOK_URL;
    if (n8nUrl) {
      await fetch(n8nUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: formattedPhone,
          name: partner.name,
          magic_link: magicLink,
          codigo: otpCode,     // Soporte para OTP temporal de 6 dÃ­gitos
          code: otpCode,       // Envialo tambiÃ©n como 'code' por si N8N lo espera asÃ­
          canal_origen: process.env.NEXT_PUBLIC_CANAL_ORIGEN || "pwa_canal_tradicional"
        })
      });
    }

    // Guardar cookie temporal para validar el OTP en el siguiente request
    const { cookies } = await import("next/headers");
    (await cookies()).set('otp_session', loginToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10 // 10 minutos
    });

    return NextResponse.json({
      message: 'Si el número es correcto, recibirás un WhatsApp con tu enlace de acceso.',
    });

  } catch (error: any) {
    console.error('Request Link Error:', error);
    return NextResponse.json({
      error: 'Error procesando solicitud.',
      details: error.message || String(error)
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
