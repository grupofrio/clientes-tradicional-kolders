"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User, LogOut, FileText, ClipboardList, Package, Phone, AlertTriangle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useB2BCartStore } from "@/store/cart";

export default function AccountPage() {
  const router = useRouter();
  const clearCart = useB2BCartStore(state => state.clearCart);

  const [partner, setPartner] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [overdueInvoices, setOverdueInvoices] = useState(0);

  useEffect(() => {
    Promise.all([
        fetch('/api/account/profile').then(res => res.ok ? res.json() : null),
        fetch('/api/b2b/invoices').then(res => res.ok ? res.json() : [])
    ]).then(([profileData, invData]) => {
        if (profileData && !profileData.error) setPartner(profileData);
        if (Array.isArray(invData)) {
            const overdue = invData.filter((i: any) => new Date(i.invoice_date_due) < new Date()).length;
            setOverdueInvoices(overdue);
        }
        setLoading(false);
    }).catch(() => {
        setLoading(false);
    });
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (_) {}
    clearCart();
    router.replace("/");
  };

  const contactExecutive = () => {
      if(!partner) return;
      const waNumber = partner.executive_phone || process.env.NEXT_PUBLIC_WA_SALES || '5218110000000';
      window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(`Hola, soy ${partner.name}. `)}`, '_blank');
  }

  if (loading) {
    return <div className="min-h-[50vh] flex justify-center items-center"><Loader2 className="animate-spin text-primary" /></div>;
  }

  const credito_disp = partner.credit_limit - partner.credit_used;
  const porcentaje_uso = partner.credit_limit > 0 ? (partner.credit_used / partner.credit_limit) * 100 : 0;
  
  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header with avatar */}
      <div className="bg-gradient-to-br from-[#1E3A8A] to-[#2563EB] pt-12 pb-16 px-6 text-center rounded-b-3xl shadow-lg">
        <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 border-2 border-white/30">
          <span className="text-white text-2xl font-black">
            {partner.name?.charAt(0).toUpperCase() || '?'}
          </span>
        </div>
        <h1 className="text-white text-xl font-black tracking-tight leading-tight">{partner.name}</h1>
        {partner.vat && <p className="text-white/70 text-xs mt-1 font-medium">RFC: {partner.vat}</p>}
      </div>

      <div className="px-4 -mt-10 space-y-3 relative z-10">
        {/* Credit card */}
        <div className="bg-card rounded-2xl p-5 shadow-lg border border-border">
          <h2 className="font-black text-foreground text-sm mb-4">Línea de Crédito Comercial</h2>
          <div className="flex justify-between items-end mb-3">
            <div>
              <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider mb-0.5">Disponible</p>
              <p className={`text-3xl font-black ${credito_disp <= 0 ? 'text-danger' : 'text-success'}`}>
                ${credito_disp.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-muted-foreground">Límite: ${partner.credit_limit.toLocaleString('en-US')}</p>
              <p className="text-[9px] text-muted-foreground">Usado: ${partner.credit_used.toLocaleString('en-US')}</p>
            </div>
          </div>
          <div className="w-full h-2.5 bg-secondary rounded-full overflow-hidden border border-border">
            <div
              className={`h-full transition-all duration-700 rounded-full ${porcentaje_uso > 90 ? 'bg-danger' : porcentaje_uso > 75 ? 'bg-warning' : 'bg-primary'}`}
              style={{ width: `${Math.min(porcentaje_uso, 100)}%` }}
            />
          </div>
        </div>

        {/* Overdue banner */}
        {overdueInvoices > 0 && (
          <div className="bg-danger/10 border border-danger/30 rounded-2xl p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-danger/20 flex items-center justify-center flex-shrink-0 text-danger">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h3 className="font-black text-danger text-sm leading-tight">{overdueInvoices} factura{overdueInvoices > 1 ? 's' : ''} vencida{overdueInvoices > 1 ? 's' : ''}</h3>
              <p className="text-[10px] text-danger/80 mt-0.5 mb-2 font-medium">Liquida para asegurar tus próximas entregas.</p>
              <Link href="/account/invoices" className="text-[10px] font-black text-danger underline">
                Liquidar facturas
              </Link>
            </div>
          </div>
        )}

        {/* Executive contact */}
        <div className="bg-card rounded-2xl p-4 shadow-sm border border-border flex justify-between items-center">
          <div>
            <p className="text-[9px] text-muted-foreground font-black uppercase tracking-wider">Ejecutivo de Cuenta</p>
            <p className="font-bold text-foreground text-sm mt-0.5">{partner.executive}</p>
          </div>
          <button
            onClick={contactExecutive}
            className="bg-success text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md"
          >
            <Phone size={13} /> WhatsApp
          </button>
        </div>

        {/* Nav menu */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
          <Link href="/account/orders" className="flex items-center gap-3 p-4 border-b border-border active:bg-muted/50 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
              <ClipboardList size={18} />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-foreground text-sm">Auditoría de Pedidos</h3>
              <p className="text-[10px] text-muted-foreground">Revisar compras y reordenar stock</p>
            </div>
            <span className="text-muted-foreground text-sm">›</span>
          </Link>
          <Link href="/account/invoices" className="flex items-center gap-3 p-4 border-b border-border active:bg-muted/50 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary relative flex-shrink-0">
              <FileText size={18} />
              {overdueInvoices > 0 && (
                <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-danger rounded-full border-2 border-white" />
              )}
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-foreground text-sm">Facturación y Pagos</h3>
              <p className="text-[10px] text-muted-foreground">Revisión de saldos y PDF</p>
            </div>
            <span className="text-muted-foreground text-sm">›</span>
          </Link>
          <Link href="/catalog" className="flex items-center gap-3 p-4 active:bg-muted/50 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
              <Package size={18} />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-foreground text-sm">Catálogo de Productos</h3>
              <p className="text-[10px] text-muted-foreground">Hacer un nuevo pedido</p>
            </div>
            <span className="text-muted-foreground text-sm">›</span>
          </Link>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 p-4 bg-card rounded-2xl border border-border text-danger font-bold text-sm active:bg-danger/5 transition-colors shadow-sm"
        >
          <LogOut size={17} /> Cerrar Sesión
        </button>
      </div>
    </div>
  );
}
