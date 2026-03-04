"use client";
import { useEffect, useState } from "react";
import { useB2BCartStore } from "@/store/cart";
import { Search, Loader2 } from "lucide-react";

export default function Catalog() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todas");

  const [partner, setPartner] = useState<any>(null);

  const cartItems = useB2BCartStore(state => state.items);
  const addItem = useB2BCartStore(state => state.addItem);
  const setQty = useB2BCartStore(state => state.setQty);

  const categories = ["Todas", "KoldCup", "KoldHome", "KoldSnack", "KoldSmuthie", "KoldHielo", "KoldWorld"];

  useEffect(() => {
    // 1. Traer perfil para credit limit
    fetch('/api/account/profile')
      .then(res => res.json())
      .then(data => {
        if (!data.error) setPartner(data);
      });

    // 2. Traer items
    fetch(`/api/catalog?category=${category}`)
      .then(res => res.json())
      .then(data => {
        setItems(data);
        setLoading(false);
      });
  }, [category]);

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase()) || 
    (item.sku && item.sku.toLowerCase().includes(search.toLowerCase()))
  );

  const handleQtyChange = (product_id: number, e: any, itemConfig: any) => {
    let rawQty = parseInt(e.target.value) || 0;
    
    // Validar múltiplos si aplica warning message o default a 1.
    // Lógica para permitir teclear libre si es B2B transaccional.
    
    // Si ya está en carrito, updatear. Si no, agregarlo full array.
    const cartExists = cartItems.find(i => i.product_id === product_id);
    if (rawQty === 0 && cartExists) {
        useB2BCartStore.getState().removeItem(product_id);
    } else if (rawQty > 0) {
        if (!cartExists) {
          addItem({
            product_id: itemConfig.id,
            name: itemConfig.name,
            sku: itemConfig.sku,
            price: itemConfig.price,
            uom_name: itemConfig.uom,
            qty: rawQty,
            qtyPerPage: itemConfig.boxSize
          });
        } else {
          setQty(product_id, rawQty);
        }
    }
  }

  const getCartQty = (id: number) => {
    return cartItems.find(i => i.product_id === id)?.qty || "";
  }

  return (
    <div className="min-h-screen bg-background pb-32">
        {/* Header Transaccional denso */}
        <div className="bg-primary pt-10 pb-6 px-4 text-white shadow-md">
           <div className="flex justify-between items-center mb-4">
              <div>
                <h1 className="text-xl font-bold font-display">{partner?.name || 'Cargando...'}</h1>
                {partner?.pricelist && <p className="text-xs text-blue-200">Lista: {partner.pricelist.name}</p>}
              </div>
              <div className="text-right">
                <p className="text-[10px] text-blue-200 uppercase font-bold tracking-wider">Crédito Disp.</p>
                <p className="font-extrabold text-lg">${(partner ? (partner.credit_limit - partner.credit_used) : 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</p>
              </div>
           </div>

           <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input 
                 type="text" 
                 placeholder="Buscar por nombre o SKU..." 
                 value={search}
                 onChange={(e) => setSearch(e.target.value)}
                 className="w-full h-11 bg-white rounded-lg pl-10 pr-4 text-sm text-foreground outline-none border-none focus:ring-2 focus:ring-accent"
              />
           </div>
        </div>

        {/* Tabs densos */}
        <div className="px-2 py-3 border-b border-border bg-white sticky top-0 z-20 flex gap-1 overflow-x-auto no-scrollbar">
          {categories.map(c => (
            <button
              key={c}
              onClick={() => { setLoading(true); setCategory(c); }}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
                category === c ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Tabla / Lista de Catálogo */}
        <main className="px-3 py-4 space-y-3">
          {loading ? (
             <div className="flex justify-center p-10"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>
          ) : filteredItems.length === 0 ? (
             <div className="text-center p-10 text-muted-foreground text-sm">No se encontraron productos.</div>
          ) : (
            filteredItems.map(item => (
              <div key={item.id} className="bg-white rounded-xl border border-border p-3 flex gap-3 shadow-sm hover:border-primary/50 transition-colors">
                
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                     <div className="flex justify-between items-start gap-2">
                        <h3 className="font-bold text-sm text-foreground leading-tight">{item.name}</h3>
                     </div>
                     <p className="text-xs text-muted-foreground mt-1">SKU: {item.sku} &bull; {item.warning || `${item.uom}`}</p>
                     
                     {item.boxSize > 1 && (
                        <span className="inline-block mt-1 bg-blue-50 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded border border-blue-100">
                          📦 Caja máster: {item.boxSize} pzas
                        </span>
                     )}
                  </div>
                  
                  <div className="mt-3 flex items-center justify-between">
                     <div>
                       <span className="font-extrabold text-foreground text-base">${item.price.toFixed(2)}</span>
                       <span className="text-[10px] text-muted-foreground ml-1">/ {item.uom}</span>
                     </div>
                     <div className="relative">
                        <input 
                           type="number" 
                           min="0"
                           value={getCartQty(item.id)}
                           onChange={(e) => handleQtyChange(item.id, e, item)}
                           placeholder="0"
                           className="w-20 h-9 bg-secondary border border-border rounded-lg text-center font-bold text-sm text-foreground outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                        />
                        <span className="absolute -top-6 right-1/2 translate-x-1/2 text-[9px] text-muted-foreground font-medium uppercase">
                          Cant.
                        </span>
                     </div>
                  </div>
                </div>

              </div>
            ))
          )}
        </main>
    </div>
  );
}
