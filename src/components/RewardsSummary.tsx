// Rewards PWA v1 — módulo visual "Próximamente".
//
// SOLO presentación. NO hace fetch, NO llama a Odoo/endpoint/API, NO muestra
// saldo/puntos/dinero/canje. Todo el copy de rewards de v1 vive AQUÍ (fuente
// única) para poder auditarlo en un solo archivo. Copy aprobado únicamente.
import Link from "next/link";
import { Gift, ChevronRight } from "lucide-react";

// Copy APROBADO v1 (no modificar sin aprobación). Prohibido: saldo, puntos,
// canjear/canje, dinero equivalente, "ya estás acumulando".
const TITLE = "Recompensas Grupo Frío";
const LINE_SHORT = "Muy pronto podrás consultar tus beneficios y recompensas desde aquí.";
const LINE_LONG = "Estamos preparando un programa para premiar tus compras frecuentes.";
const BADGE = "Próximamente";

function ComingSoonBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-primary/10 text-primary text-[10px] font-black tracking-wide px-2 py-0.5">
      {BADGE}
    </span>
  );
}

/** Card compacta para /home. Toda la card es un Link a /rewards. */
function RewardsCard() {
  return (
    <Link
      href="/rewards"
      className="flex items-start gap-3 bg-card border border-border rounded-2xl p-4 active:bg-muted/50 transition-colors"
    >
      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Gift size={17} className="text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-black text-foreground text-sm leading-tight">{TITLE}</h3>
          <ComingSoonBadge />
        </div>
        <p className="text-[11px] text-muted-foreground mt-1 font-medium">{LINE_SHORT}</p>
      </div>
      <ChevronRight size={18} className="text-muted-foreground flex-shrink-0 mt-1" />
    </Link>
  );
}

/** Panel completo para la ruta /rewards. */
function RewardsPagePanel() {
  return (
    <div className="flex flex-col items-center text-center gap-4 bg-card border border-border rounded-2xl p-8">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Gift size={30} className="text-primary" />
      </div>
      <ComingSoonBadge />
      <h1 className="font-black text-foreground text-lg leading-tight">{TITLE}</h1>
      <p className="text-sm text-muted-foreground font-medium max-w-xs">{LINE_SHORT}</p>
      <p className="text-xs text-muted-foreground/80 font-medium max-w-xs">{LINE_LONG}</p>
    </div>
  );
}

export default function RewardsSummary({ variant }: { variant: "card" | "page" }) {
  return variant === "card" ? <RewardsCard /> : <RewardsPagePanel />;
}
