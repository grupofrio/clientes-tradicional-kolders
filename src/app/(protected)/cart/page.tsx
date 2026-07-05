"use client";
import { useEffect, useState } from "react";
import { useB2BCartStore } from "@/store/cart";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, ArrowLeft } from "lucide-react";
import { format, addDays } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";

export default function CartPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  const { items, setQty, setNote, removeItem, clearCart, getTotal } = useB2BCartStore();

  const [partner, setPartner] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  const [dateStr, setDateStr] = useState(format(addDays(new Date(), 1), "yyyy-MM-dd"));
  const [horario, setHorario] = useState("Mañana (8:00 - 13:00)");
  const [paymentMethod, setPaymentMethod] = useState("efectivo");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setMounted(true);
    fetch('/api/account/profile')
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setPartner(data);
          // Default efectivo. Crédito solo aparece como opción si
          // credit_limit > 0 (y el server lo revalida en orders/create).
        }
        setLoadingProfile(false);
      })
      .catch(() => {
        setLoadingProfile(false);
      });
  }, []);

  if (!mounted) return null;

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center text-muted-foreground mb-4 border border-border">
          <Trash2 size={32} />
        </div>
        <h1 className="text-xl font-black text-foreground mb-2">Tu carrito está vacío</h1>
        <p className="text-sm text-muted-foreground mb-8">Agrega productos para tu tienda desde el catálogo.</p>
        <Link href="/catalog" className="bg-gradient-to-r from-primary to-accent text-white font-bold px-8 py-4 rounded-2xl shadow-lg shadow-primary/25">
          Ir al Catálogo
        </Link>
      </div>
    );
  }

  const subtotal = getTotal();
  // IVA desde el impuesto REAL de cada producto (tax_rate de Odoo), no asumir 16%.
  // Producto sin impuesto válido → tax_rate 0 → no infla el total.
  const iva = Math.round(
    items.reduce((acc, it) => acc + it.price * it.qty * ((it.tax_rate || 0) / 100), 0) * 100
  ) / 100;
  const total = Math.round((subtotal + iva) * 100) / 100;

  let creditoDisponible = 0;
  let superaCredito = false;
  if (partner) {
      creditoDisponible = partner.credit_limit - partner.credit_used;
      superaCredito = total > creditoDisponible;
  }

  const handleCheckout = async () => {
    if (checkoutLoading) return;
    setCheckoutLoading(true);
    setCheckoutError("");

    try {
      // Paso 1: Validar carrito server-side contra Odoo (precios, stock, existencia)
      const validateRes = await fetch('/api/cart/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cart_lines: items })
      });

      const validation = await validateRes.json();
      if (!validateRes.ok) {
        setCheckoutError(validation.error || "Error validando el carrito.");
        return;
      }

      if (!validation.valid) {
        const msgs = validation.issues.map((i: any) => i.message).join('\n');
        setCheckoutError(`Problemas detectados:\n${msgs}`);
        return;
      }

      // Paso 2: Crear la orden en Odoo con datos validados
      const res = await fetch('/api/b2b/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cart_lines: items,
          delivery_date: dateStr,
          delivery_schedule: horario,
          payment_method: paymentMethod,
          notes: notes
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setCheckoutError(data.error || "Error al crear la orden. Intenta nuevamente.");
      } else {
        clearCart();
        router.push(`/order/confirmed?orderName=${data.order_name}&status=${data.status}&executive=${encodeURIComponent(data.ejecutivo_nombre)}&executiveId=${data.ejecutivo_id}`);
      }
    } catch (e) {
      setCheckoutError("Error de conexión. Verifica tu red e intenta de nuevo.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-36">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#005A8D] to-[#00B8D4] pt-10 pb-4 px-4 shadow-lg">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 flex items-center justify-center bg-white/15 text-white rounded-xl"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-white text-lg font-black">Tu pedido</h1>
          <div className="ml-auto">
            <button
              onClick={clearCart}
              className="text-white/70 flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg bg-white/10"
            >
              <Trash2 size={13} /> Vaciar
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Product list */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          {items.map((l, idx) => (
            <div
              key={l.product_id}
              className={`p-4 flex gap-3 ${idx < items.length - 1 ? 'border-b border-border' : ''}`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-foreground truncate mb-0.5">{l.name}</p>
                {l.sku && <p className="text-[9px] text-muted-foreground mb-1">{l.sku}</p>}
                <p className="text-sm font-black text-primary">${l.price.toFixed(2)} <span className="text-[9px] font-normal text-muted-foreground">/ u</span></p>
                <input
                  className="w-full mt-2 bg-secondary text-xs h-7 px-2 rounded-lg outline-none placeholder:text-muted-foreground border border-border"
                  placeholder="Nota del producto..."
                  value={l.note || ''}
                  onChange={e => setNote(l.product_id, e.target.value)}
                />
              </div>
              <div className="flex flex-col items-end gap-2">
                <button onClick={() => removeItem(l.product_id)} className="text-danger">
                  <Trash2 size={14} />
                </button>
                <p className="font-black text-sm text-foreground">
                  ${(Math.round(l.price * l.qty * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
                <input
                  type="number"
                  value={l.qty}
                  onChange={e => setQty(l.product_id, parseInt(e.target.value) || 1)}
                  className="w-14 h-8 text-center text-sm font-bold bg-secondary border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Delivery details */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-4">
          <h3 className="font-black text-foreground text-sm">Entrega</h3>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Dirección de Entrega</label>
            <div className="w-full h-11 bg-secondary rounded-xl px-3 flex items-center text-sm border border-border">
              {loadingProfile
                ? <Loader2 size={14} className="animate-spin text-muted-foreground" />
                : <span className="font-medium truncate text-foreground">{partner?.address || 'Dirección principal no registrada'}</span>
              }
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Fecha (Mín 24h)</label>
              <input
                type="date"
                min={format(addDays(new Date(), 1), "yyyy-MM-dd")}
                value={dateStr}
                onChange={e => setDateStr(e.target.value)}
                className="w-full h-11 bg-card border border-border rounded-xl px-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Horario</label>
              <select
                value={horario}
                onChange={e => setHorario(e.target.value)}
                className="w-full h-11 bg-card border border-border rounded-xl px-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="Mañana (8:00 - 13:00)">Mañana</option>
                <option value="Tarde (13:00 - 18:00)">Tarde</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Observaciones</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              maxLength={2000}
              className="w-full h-20 resize-none bg-card border border-border rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
              placeholder="Ej: Solo recibir por entrada trasera..."
            />
          </div>
        </div>

        {/* Totals + payment */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-4">
          <h3 className="font-black text-foreground text-sm">Resumen de tu pedido</h3>
          <div className="bg-secondary rounded-xl p-4 space-y-2 border border-border">
            <div className="flex justify-between text-sm font-medium">
              <span className="text-muted-foreground">Subtotal (sin IVA)</span>
              <span className="font-bold">${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-sm font-medium text-muted-foreground">
              <span>IVA</span>
              <span>${iva.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-primary font-black text-lg">
              <span>Total</span>
              <span>${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {!loadingProfile && (
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Método de Pago</label>
              {/* Crédito solo se ofrece si el cliente tiene crédito AUTORIZADO
                  (credit_limit > 0). El server lo revalida en orders/create. */}
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                className="w-full h-11 bg-card border border-border rounded-xl px-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="efectivo">Efectivo contra entrega</option>
                <option value="tarjeta">Tarjeta</option>
                {partner && partner.credit_limit > 0 && (
                  <option value="credito">Crédito</option>
                )}
              </select>
            </div>
          )}

          {paymentMethod === 'credito' && (
            <div className={`p-3 rounded-xl border text-sm font-medium ${superaCredito ? 'bg-danger/10 border-danger/30 text-danger' : 'bg-success/10 border-success/30 text-success'}`}>
              <div className="flex justify-between font-bold mb-1">
                <span>Límite Total:</span>
                <span>${partner.credit_limit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span>Crédito Usado:</span>
                <span>${partner.credit_used.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between font-black border-t border-current/20 pt-1 mt-1">
                <span>Disponible tras pedido:</span>
                <span>${(Math.round((creditoDisponible - total) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
              {superaCredito && <p className="text-[10px] mt-2 font-bold">Esta operación supera tu límite. Pasará a revisión Comercial como Cotización.</p>}
            </div>
          )}

          {checkoutError && <p className="text-danger text-sm font-bold">{checkoutError}</p>}

          <button
            onClick={handleCheckout}
            disabled={checkoutLoading || loadingProfile}
            className="w-full h-14 rounded-2xl bg-gradient-to-r from-primary to-accent text-white font-black tracking-wide transition-all disabled:opacity-50 flex items-center justify-center shadow-lg shadow-primary/25"
          >
            {checkoutLoading ? <Loader2 className="animate-spin w-5 h-5" /> : "Confirmar pedido"}
          </button>
        </div>
      </div>
    </div>
  );
}
