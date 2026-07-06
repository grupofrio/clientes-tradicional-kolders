"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  RefreshCw,
  Package,
  ClipboardList,
  FileText,
  User,
  Star,
  ChevronRight,
} from "lucide-react";
import { useB2BCartStore } from "@/store/cart";
import { rehydrateReorder } from "@/lib/reorder";
import ReorderConfirmModal from "@/components/ReorderConfirmModal";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  draft: { label: "En revisión", cls: "bg-warning/15 text-warning" },
  sent: { label: "En revisión", cls: "bg-warning/15 text-warning" },
  sale: { label: "Confirmado", cls: "bg-primary/15 text-primary" },
  done: { label: "Entregado", cls: "bg-success/15 text-success" },
  cancel: { label: "Cancelado", cls: "bg-danger/15 text-danger" },
};

interface HomeOrderLine {
  product_id: number;
  name: string;
  qty: number;
  price: number;
}

interface HomeOrder {
  id: number;
  name: string;
  state: string;
  date_order: string;
  amount_total: number;
  lines?: HomeOrderLine[];
}

const QUICK_LINKS = [
  { name: "Catálogo", desc: "Todos los productos", href: "/catalog", icon: Package },
  { name: "Mis pedidos", desc: "Historial y estado", href: "/account/orders", icon: ClipboardList },
  { name: "Mis pagos", desc: "Saldos y facturas", href: "/account/invoices", icon: FileText },
  { name: "Mi cuenta", desc: "Datos y asesor", href: "/account", icon: User },
];

export default function HomePage() {
  const router = useRouter();
  const addItem = useB2BCartStore((state) => state.addItem);
  const clearCart = useB2BCartStore((state) => state.clearCart);
  const cartCount = useB2BCartStore((state) => state.getTotalItems());

  const [partner, setPartner] = useState<{ name?: string } | null>(null);
  const [orders, setOrders] = useState<HomeOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [ordersError, setOrdersError] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const fetchHome = () => {
    fetch("/api/account/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && !data.error) setPartner(data);
      })
      .catch(() => {});

    fetch("/api/b2b/orders/history")
      .then((res) => {
        if (!res.ok) throw new Error("history");
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) setOrders(data);
        else setOrdersError(true);
        setLoadingOrders(false);
      })
      .catch(() => {
        setOrdersError(true);
        setLoadingOrders(false);
      });
  };

  useEffect(() => {
    fetchHome();
  }, []);

  const retryOrders = () => {
    setLoadingOrders(true);
    setOrdersError(false);
    fetchHome();
  };

  // "Pedido de siempre" = el más reciente no cancelado y con líneas.
  const usualOrder = orders.find(
    (o) => o.state !== "cancel" && Array.isArray(o.lines) && o.lines.length > 0,
  );

  // Ejecuta la recompra. `replace=true` vacía el carrito antes de rehidratar;
  // `false` suma al carrito existente (comportamiento original).
  const runRepeat = async (replace: boolean) => {
    if (!usualOrder || reordering) return;
    setReordering(true);
    try {
      if (replace) clearCart();
      const { added, omitted } = await rehydrateReorder(usualOrder, addItem);
      if (omitted.length > 0) {
        alert(
          `Estos productos ya no están disponibles y no se agregaron:\n- ${omitted.join("\n- ")}`,
        );
      }
      if (added > 0) {
        setConfirmOpen(false);
        router.push("/cart");
      } else if (omitted.length === 0) {
        alert("Este pedido no tiene productos para repetir.");
      }
    } catch {
      alert("No se pudo preparar el pedido. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setReordering(false);
    }
  };

  // Si el carrito ya tiene productos, preguntamos antes de duplicar cantidades.
  const handleRepeat = () => {
    if (!usualOrder || reordering) return;
    if (cartCount > 0) {
      setConfirmOpen(true);
      return;
    }
    runRepeat(false);
  };

  const status = usualOrder ? STATUS_LABEL[usualOrder.state] : null;

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#005A8D] to-[#00B8D4] pt-10 pb-12 px-4 shadow-lg rounded-b-3xl">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-white rounded-xl flex-shrink-0 flex items-center justify-center shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/grupo-frio-logo-mark.png" alt="Grupo Frío" width={26} height={26} />
          </div>
          <div className="min-w-0">
            <p className="text-white/70 text-[9px] font-bold tracking-[0.15em] uppercase mb-0.5">
              Portal de Clientes Grupo Frío
            </p>
            <h1 className="text-white text-lg font-black tracking-tight truncate">
              {partner?.name ? `Hola, ${partner.name}` : "Bienvenido"}
            </h1>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-6 space-y-3 relative z-10">
        {/* Card principal: recompra */}
        <div className="bg-card rounded-2xl border border-border shadow-lg p-5">
          {loadingOrders ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin text-primary w-6 h-6" />
            </div>
          ) : ordersError ? (
            <div className="text-center py-4">
              <p className="font-bold text-danger text-sm mb-1">No pudimos cargar tus pedidos</p>
              <p className="text-muted-foreground text-xs mb-3">
                Revisa tu conexión e intenta de nuevo.
              </p>
              <button onClick={retryOrders} className="text-primary text-sm font-bold underline">
                Reintentar
              </button>
            </div>
          ) : usualOrder ? (
            <>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 className="font-black text-foreground text-base">Tu pedido de siempre</h2>
                  <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
                    {usualOrder.name} ·{" "}
                    {new Date(usualOrder.date_order).toLocaleDateString()}
                    {status && (
                      <span className={`ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold ${status.cls}`}>
                        {status.label}
                      </span>
                    )}
                  </p>
                </div>
                <p className="font-black text-primary text-base flex-shrink-0 ml-3">
                  ${usualOrder.amount_total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="space-y-1 mb-4">
                {usualOrder.lines!.slice(0, 3).map((line, i) => (
                  <p key={i} className="text-xs text-foreground font-medium truncate">
                    {line.qty}× {line.name.split("\n")[0]}
                  </p>
                ))}
                {usualOrder.lines!.length > 3 && (
                  <p className="text-[10px] text-muted-foreground">
                    + {usualOrder.lines!.length - 3} producto{usualOrder.lines!.length - 3 !== 1 ? "s" : ""} más
                  </p>
                )}
              </div>
              <button
                onClick={handleRepeat}
                disabled={reordering}
                className="w-full h-13 py-3.5 rounded-2xl bg-gradient-to-r from-primary to-accent text-white font-black tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-primary/25 active:scale-[0.98] transition-all disabled:opacity-60"
              >
                {reordering ? (
                  <Loader2 className="animate-spin w-5 h-5" />
                ) : (
                  <>
                    <RefreshCw size={17} /> Repetir mi pedido de siempre
                  </>
                )}
              </button>
              <Link
                href="/catalog"
                className="w-full mt-2 py-3 rounded-2xl border border-border text-foreground font-bold text-sm flex items-center justify-center gap-2 active:bg-muted/50 transition-colors"
              >
                Hacer pedido nuevo
              </Link>
            </>
          ) : (
            <div className="text-center py-2">
              <div className="text-3xl mb-2">🧊</div>
              <h2 className="font-black text-foreground text-base mb-1">
                ¡Bienvenido a tu portal!
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Haz tu primer pedido y tenlo listo para repetir cuando quieras.
              </p>
              <Link
                href="/catalog"
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-primary to-accent text-white font-black tracking-wide flex items-center justify-center shadow-lg shadow-primary/25"
              >
                Hacer mi primer pedido
              </Link>
            </div>
          )}
        </div>

        {/* Teaser de recompensas — SIN datos: el programa aún no está en vivo */}
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Star size={17} className="text-amber-600" />
          </div>
          <div>
            <h3 className="font-black text-amber-800 text-sm leading-tight">
              Muy pronto tus compras sumarán puntos y recompensas Grupo Frío.
            </h3>
            <p className="text-[11px] text-amber-700/80 mt-1 font-medium">
              Estamos preparando beneficios para clientes frecuentes.
            </p>
          </div>
        </div>

        {/* Accesos rápidos */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
          {QUICK_LINKS.map(({ name, desc, href, icon: Icon }, idx) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 p-4 active:bg-muted/50 transition-colors ${
                idx < QUICK_LINKS.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                <Icon size={18} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-foreground text-sm">{name}</h3>
                <p className="text-[10px] text-muted-foreground">{desc}</p>
              </div>
              <ChevronRight size={16} className="text-muted-foreground" />
            </Link>
          ))}
        </div>
      </div>

      <ReorderConfirmModal
        open={confirmOpen}
        busy={reordering}
        onReplace={() => runRepeat(true)}
        onAdd={() => runRepeat(false)}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
