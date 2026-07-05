import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Image from "next/image";
import { ShoppingCart, ClipboardList, Star, Gift, Lock } from "lucide-react";

// Número del bot de servicio Grupo Frío (WhatsApp). Configurable por env;
// el fallback es el número REAL confirmado del bot — nunca un número inventado.
const WA_BOT = process.env.NEXT_PUBLIC_WA_BOT || "525540000990";
const WA_LINK = `https://wa.me/${WA_BOT}?text=${encodeURIComponent("Hola, quiero mi acceso al Portal de Clientes Grupo Frío")}`;

const BULLETS = [
  { icon: ShoppingCart, text: "Pide fácil desde tu celular." },
  { icon: ClipboardList, text: "Consulta tus pedidos y pagos." },
  { icon: Star, text: "Tus compras sumarán puntos." },
  { icon: Gift, text: "Muy pronto podrás canjear recompensas para tu tienda." },
];

export default async function Home() {
  // Cliente con sesión activa → directo a su inicio, sin pasar por la portada.
  const session = (await cookies()).get("session")?.value;
  if (session) redirect("/home");

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#F0F9FF] via-[#E0F3FC] to-[#C9EBF8] flex flex-col relative px-6 py-10">
      <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full z-10">

        {/* Logo oficial Grupo Frío (el wordmark viene incluido en el asset) */}
        <div className="mb-8 flex flex-col items-center text-center">
          <Image
            src="/brand/grupo-frio-logo.png"
            alt="Grupo Frío"
            width={453}
            height={243}
            priority
            className="w-[248px] h-auto mb-4 drop-shadow-sm"
          />
          <h1 className="text-[#0077BB] font-black tracking-[0.22em] text-[11px] uppercase">
            Portal de Clientes
          </h1>
        </div>

        {/* Promesa de valor */}
        <div className="text-center mb-7">
          <h2 className="text-lg font-bold text-[#0F2A3D] leading-snug text-balance">
            Haz tus pedidos, gana puntos y canjea recompensas con Grupo Frío.
          </h2>
          <p className="text-sm text-[#5B7285] mt-2 leading-relaxed">
            Accede con tu enlace seguro de WhatsApp, repite tus pedidos y consulta tus beneficios desde un solo lugar.
          </p>
        </div>

        {/* Beneficios */}
        <div className="bg-white/80 rounded-2xl border border-[#DBEFF9] p-4 mb-7 space-y-3 shadow-sm">
          {BULLETS.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#F0F9FF] border border-[#DBEFF9] flex items-center justify-center flex-shrink-0">
                <Icon size={15} className="text-[#0077BB]" />
              </div>
              <p className="text-[13px] font-medium text-[#0F2A3D] leading-snug">{text}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="space-y-3">
          <a
            href={WA_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full h-14 rounded-2xl bg-[#25D366] text-white font-black text-base tracking-wide transition-all active:scale-95 flex items-center justify-center gap-3 shadow-xl shadow-green-500/25"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Recibir enlace de acceso
          </a>

          <p className="text-center text-[11px] text-[#5B7285] leading-relaxed">
            Se abrirá WhatsApp con un mensaje listo.<br />
            El asistente Grupo Frío te enviará tu acceso.
          </p>

          {/* ¿Cómo funciona? — sin JS, con <details> nativo */}
          <details className="group text-center">
            <summary className="list-none cursor-pointer text-[#0077BB] text-xs font-bold underline underline-offset-2 inline-block">
              ¿Cómo funciona?
            </summary>
            <ol className="mt-3 bg-white/80 rounded-2xl border border-[#DBEFF9] p-4 text-left space-y-2 text-[13px] text-[#0F2A3D] font-medium">
              <li className="flex gap-2"><span className="font-black text-[#0077BB]">1.</span> Pide tu enlace por WhatsApp.</li>
              <li className="flex gap-2"><span className="font-black text-[#0077BB]">2.</span> Entra a tu portal seguro.</li>
              <li className="flex gap-2"><span className="font-black text-[#0077BB]">3.</span> Haz pedidos y empieza a sumar beneficios.</li>
            </ol>
          </details>
        </div>

        {/* Sello de acceso seguro */}
        <div className="mt-7 flex items-center justify-center gap-1.5 text-[10px] text-[#5B7285] font-medium">
          <Lock size={11} className="text-[#0077BB]" />
          Acceso seguro por WhatsApp · Grupo Frío
        </div>
      </div>

      {/* Blobs decorativos fríos */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-[#00B8D4]/10 rounded-full blur-3xl -z-10 translate-x-1/3 -translate-y-1/3 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-[#0077BB]/10 rounded-full blur-3xl -z-10 -translate-x-1/3 translate-y-1/3 pointer-events-none" />
    </main>
  );
}
