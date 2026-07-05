/**
 * Guardrails mínimos para endpoints que mutan (o consultan Odoo) autenticados
 * solo por la cookie `session`.
 *
 * - verifySameOrigin: CSRF-equivalente. Los fetch de la PWA son same-origin y
 *   el navegador SIEMPRE manda Origin en POST; sameSite=lax ya evita enviar la
 *   cookie en POST cross-site, esto cierra el resto (subdominios, Referer viejo,
 *   clientes no-navegador con cookie robada sin headers).
 * - rateLimit: límite en memoria POR INSTANCIA serverless. No es un límite
 *   distribuido — es una barrera mínima contra ráfagas/fuerza bruta; el límite
 *   fuerte debe vivir en n8n (auth) y Odoo.
 * - previewMutationBlocked: en deployments de PREVIEW de Vercel no se permiten
 *   mutaciones reales contra Odoo productivo, salvo partners de prueba
 *   explícitamente allowlisted vía PREVIEW_MUTATIONS_ALLOWLIST="123,456".
 */

const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  // Limpieza oportunista para que el Map no crezca sin límite en instancias longevas
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) {
      if (now >= b.resetAt) buckets.delete(k);
    }
  }
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

export function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  return fwd ? fwd.split(',')[0].trim() : 'unknown';
}

export function verifySameOrigin(request: Request): boolean {
  const host = request.headers.get('host');
  if (!host) return false;

  const matchesHost = (value: string | null): boolean | null => {
    if (!value) return null;
    try {
      return new URL(value).host === host;
    } catch {
      return false;
    }
  };

  const originOk = matchesHost(request.headers.get('origin'));
  if (originOk !== null) return originOk;

  const refererOk = matchesHost(request.headers.get('referer'));
  if (refererOk !== null) return refererOk;

  // POST de navegador sin Origin ni Referer no ocurre en los fetch de la PWA.
  return false;
}

export function previewMutationBlocked(partnerId?: number | string): boolean {
  if (process.env.VERCEL_ENV !== 'preview') return false;
  const allowlist = (process.env.PREVIEW_MUTATIONS_ALLOWLIST || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (partnerId === undefined || partnerId === null) return true;
  return !allowlist.includes(String(partnerId));
}

export const PREVIEW_BLOCKED_MESSAGE =
  'Este entorno de prueba no puede crear operaciones reales. Usa la app oficial o pide habilitar tu cuenta de prueba.';
