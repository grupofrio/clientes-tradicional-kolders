"use client";
import { useEffect, useState } from "react";
import { useB2BCartStore } from "@/store/cart";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

export default function OrderHistory() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const addItem = useB2BCartStore(state => state.addItem);

  useEffect(() => {
    fetch('/api/b2b/orders/history')
      .then(res => res.json())
      .then(data => {
        if (!data.error) setOrders(data);
        setLoading(false);
      });
  }, []);

  const handleReorder = (order: any) => {
     order.lines.forEach((line: any) => {
         addItem({
             product_id: line.product_id,
             name: line.name,
             sku: "REORDER",
             price: line.price,
             uom_name: line.uom,
             qty: line.qty,
             qtyPerPage: 1
         });
     });
     router.push("/cart");
  };

  const getStatusBadge = (state: string) => {
    switch (state) {
      case 'draft': 
      case 'sent': return <span className="bg-warning/20 text-warning px-2 py-0.5 rounded text-[10px] font-bold">🟡 En revisión</span>;
      case 'sale': return <span className="bg-primary/20 text-primary px-2 py-0.5 rounded text-[10px] font-bold">🔵 Confirmado</span>;
      case 'done': return <span className="bg-success/20 text-success px-2 py-0.5 rounded text-[10px] font-bold">🟢 Entregado</span>;
      case 'cancel': return <span className="bg-danger/20 text-danger px-2 py-0.5 rounded text-[10px] font-bold">🔴 Cancelado</span>;
      default: return null;
    }
  };

  const getInvoiceBadge = (status: string) => {
       if (status === 'to_invoice') return <span className="text-[10px] text-muted-foreground border border-border px-1.5 rounded">Por facturar</span>;
       if (status === 'invoiced') return <span className="text-[10px] bg-blue-50 text-primary border border-primary/20 px-1.5 rounded">Facturado</span>;
       return null;
  }

  return (
    <div className="min-h-screen bg-background pb-32">
        <div className="bg-white border-b border-border p-4 sticky top-0 z-20 shadow-sm flex items-center gap-3">
            <button onClick={() => router.push('/account')} className="w-10 h-10 flex items-center justify-center bg-muted text-foreground rounded-full hover:bg-muted/80 transition-colors">
                <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-bold text-foreground font-display">Auditoría de Pedidos</h1>
        </div>

        <div className="p-4 space-y-4">
           {loading ? (
              <div className="flex justify-center p-10"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>
           ) : orders.length === 0 ? (
              <div className="text-center p-10 text-muted-foreground text-sm font-medium">No se encontraron pedidos comerciales.</div>
           ) : (
             orders.map(order => (
                <div key={order.id} className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
                   <div className="p-4 border-b border-border bg-muted/5 flex justify-between items-start">
                       <div>
                           <div className="flex items-center gap-2 mb-1">
                               <h3 className="font-extrabold text-foreground text-base tracking-tight">{order.name}</h3>
                               {getStatusBadge(order.state)}
                           </div>
                           <p className="text-xs text-muted-foreground font-medium mb-1">{new Date(order.date_order).toLocaleDateString()} a las {new Date(order.date_order).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                           {getInvoiceBadge(order.invoice_status)}
                       </div>
                       <div className="text-right">
                           <p className="font-extrabold text-lg text-foreground">${order.amount_total.toLocaleString('en-US', {minimumFractionDigits: 2})}</p>
                       </div>
                   </div>

                   {/* Accordion / Detalles inline */}
                   {expandedId === order.id && (
                       <div className="px-4 py-3 bg-white">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2">Desglose de Líneas</p>
                          <div className="space-y-2">
                              {order.lines?.map((line: any, index: number) => (
                                  <div key={index} className="flex justify-between items-center text-xs">
                                     <span className="font-medium text-foreground max-w-[200px] truncate">{line.qty}x {line.name.split('\n')[0]}</span>
                                     <span className="font-bold text-muted-foreground">${(line.qty * line.price).toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                                  </div>
                              ))}
                          </div>
                       </div>
                   )}

                   <div className="p-3 bg-white flex gap-2">
                       <button onClick={() => setExpandedId(expandedId === order.id ? null : order.id)} className="flex-1 bg-secondary text-foreground text-xs font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors hover:bg-secondary/80">
                           {expandedId === order.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                           {expandedId === order.id ? 'Ocultar Detalle' : 'Ver Detalle'}
                       </button>
                       <button onClick={() => handleReorder(order)} className="flex-1 bg-primary/10 text-primary border border-primary/20 text-xs font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 hover:bg-primary hover:text-white transition-all">
                           <RefreshCw size={14} /> Reordenar
                       </button>
                   </div>
                </div>
             ))
           )}
        </div>
    </div>
  );
}
