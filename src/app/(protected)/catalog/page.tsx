"use client";
import { useEffect, useState, useMemo } from "react";
import { useB2BCartStore } from "@/store/cart";
import { Search, Loader2, AlertCircle, ChevronDown, ShoppingCart, Snowflake, Package } from "lucide-react";
import Link from "next/link";

interface CatalogItem {
  id: number;
  name: string;
  sku: string | null;
  price: number;
  tax_rate?: number;
  image_url?: string | null;
  uom: string;
  boxSize: number;
  stock: number;
  warning: string;
  family_key: string;
  family_label: string;
  subgroup_key: string;
  subgroup_label: string;
  sort_order: number;
}

export default function Catalog() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [activeFamily, setActiveFamily] = useState<string>("ALL");
  const [collapsedSubgroups, setCollapsedSubgroups] = useState<Set<string>>(new Set());
  const [brokenImg, setBrokenImg] = useState<Set<number>>(new Set());
  const [partner, setPartner] = useState<any>(null);

  const cartItems = useB2BCartStore(state => state.items);
  const addItem = useB2BCartStore(state => state.addItem);
  const setQty = useB2BCartStore(state => state.setQty);

  useEffect(() => {
    fetch('/api/account/profile')
      .then(res => res.json())
      .then(data => { if (!data.error) setPartner(data); })
      .catch(() => {});

    fetch('/api/catalog')
      .then(res => {
        if (!res.ok) throw new Error('Error del servidor');
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          setItems(data);
          const hasLaurita = data.some((d: CatalogItem) => d.family_key === 'LAURITA');
          setActiveFamily(hasLaurita ? 'LAURITA' : 'ALL');
        } else {
          setItems([]);
          setError("No se pudieron cargar los productos.");
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        setError("Error de conexion. Verifica tu red e intenta de nuevo.");
      });
  }, []);

  const families = useMemo(() => {
    const familyMap = new Map<string, { key: string; label: string; count: number; minOrder: number }>();
    items.forEach(item => {
      const existing = familyMap.get(item.family_key);
      if (existing) {
        existing.count++;
        existing.minOrder = Math.min(existing.minOrder, item.sort_order);
      } else {
        familyMap.set(item.family_key, { key: item.family_key, label: item.family_label, count: 1, minOrder: item.sort_order });
      }
    });
    return Array.from(familyMap.values()).sort((a, b) => a.minOrder - b.minOrder);
  }, [items]);

  const filteredItems = useMemo(() => {
    let filtered = items;
    if (activeFamily !== 'ALL') filtered = filtered.filter(item => item.family_key === activeFamily);
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(q) || (item.sku && item.sku.toLowerCase().includes(q))
      );
    }
    return filtered;
  }, [items, activeFamily, search]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, { key: string; label: string; items: CatalogItem[]; minOrder: number }>();
    filteredItems.forEach(item => {
      const groupKey = `${item.family_key}__${item.subgroup_key}`;
      const existing = groups.get(groupKey);
      if (existing) {
        existing.items.push(item);
      } else {
        groups.set(groupKey, { key: groupKey, label: item.subgroup_label, items: [item], minOrder: item.sort_order });
      }
    });
    return Array.from(groups.values()).sort((a, b) => a.minOrder - b.minOrder);
  }, [filteredItems]);

  const toggleSubgroup = (key: string) => {
    setCollapsedSubgroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const getCartQty = (id: number): number => {
    const item = cartItems.find(i => i.product_id === id);
    return item ? item.qty : 0;
  };

  const handleIncrement = (item: CatalogItem) => {
    const currentQty = getCartQty(item.id);
    const newQty = currentQty + 1;
    if (currentQty === 0) {
      addItem({
        product_id: item.id,
        name: item.name,
        sku: item.sku || "",
        price: item.price,
        tax_rate: item.tax_rate || 0,
        uom_name: item.uom,
        qty: 1,
        qtyPerPage: item.boxSize,
      });
    } else {
      setQty(item.id, newQty);
    }
  };

  const handleDecrement = (item: CatalogItem) => {
    const currentQty = getCartQty(item.id);
    if (currentQty <= 1) {
      useB2BCartStore.getState().removeItem(item.id);
    } else {
      setQty(item.id, currentQty - 1);
    }
  };

  const totalCartItems = cartItems.reduce((sum, i) => sum + i.qty, 0);
  const totalCartValue = cartItems.reduce((sum, i) => sum + i.price * i.qty, 0);

  return (
    <div className="min-h-screen bg-background pb-36">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#005A8D] to-[#00B8D4] pt-10 pb-4 px-4 shadow-lg">
        <div className="flex justify-between items-start mb-3">
          <div className="min-w-0 flex-1 flex items-center gap-2.5">
            {/* Mark oficial GF en chip blanco — el logo completo vive en la portada */}
            <div className="w-9 h-9 bg-white rounded-xl flex-shrink-0 flex items-center justify-center shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/grupo-frio-logo-mark.png" alt="Grupo Frío" width={26} height={26} />
            </div>
            <div className="min-w-0">
              <p className="text-white/70 text-[9px] font-bold tracking-[0.15em] uppercase mb-0.5">Portal de Clientes Grupo Frío</p>
              <h1 className="text-white text-lg font-black tracking-tight truncate">
                {partner?.name ? `Hola, ${partner.name}` : 'Bienvenido'}
              </h1>
            </div>
          </div>
          {/* Bloque financiero SOLO para clientes con crédito autorizado.
              Al cliente de contado no se le muestra "$0.00 disponible". */}
          {partner && partner.credit_limit > 0 && (
            <div className="bg-white/15 rounded-xl px-3 py-2 text-right flex-shrink-0 ml-3">
              <p className="text-white/70 text-[8px] font-bold tracking-widest uppercase">Crédito disponible</p>
              <p className="text-white font-extrabold text-base">
                ${(partner.credit_limit - partner.credit_used).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar producto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 bg-white/15 rounded-xl pl-9 pr-4 text-sm text-white placeholder:text-white/40 outline-none focus:bg-white/20 transition-colors"
          />
        </div>
      </div>

      {/* Teaser de recompensas — sin números ni saldos: el programa aún no está en vivo */}
      <div className="bg-amber-50 border-b border-amber-100 px-4 py-2 flex items-center gap-2">
        <span aria-hidden="true">⭐</span>
        <p className="text-[11px] font-bold text-amber-700">
          Muy pronto tus compras sumarán puntos y recompensas Grupo Frío.
        </p>
      </div>

      {/* Family tabs */}
      <div className="px-3 py-2.5 border-b border-border bg-card sticky top-0 z-20 flex gap-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveFamily('ALL')}
          className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
            activeFamily === 'ALL'
              ? 'bg-primary text-white shadow-md shadow-primary/30'
              : 'bg-secondary text-muted-foreground border border-border'
          }`}
        >
          Todas
        </button>
        {families.map(f => (
          <button
            key={f.key}
            onClick={() => setActiveFamily(f.key)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeFamily === f.key
                ? 'bg-primary text-white shadow-md shadow-primary/30'
                : 'bg-secondary text-muted-foreground border border-border'
            }`}
          >
            {f.label} <span className="opacity-60 ml-0.5">{f.count}</span>
          </button>
        ))}
      </div>

      <main className="px-3 py-3">
        {loading ? (
          <div className="flex justify-center p-10">
            <Loader2 className="animate-spin text-primary w-8 h-8" />
          </div>
        ) : error ? (
          <div className="text-center p-10 bg-card border border-danger/20 rounded-2xl">
            <AlertCircle size={32} className="text-danger mx-auto mb-3" />
            <p className="text-danger text-sm font-bold mb-3">{error}</p>
            <button
              onClick={() => { setLoading(true); setError(""); window.location.reload(); }}
              className="text-primary text-sm font-bold underline"
            >
              Reintentar
            </button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center p-10 text-muted-foreground text-sm">
            {search ? 'No se encontraron productos para esta búsqueda.' : 'No hay productos disponibles.'}
          </div>
        ) : (
          <div className="space-y-4">
            {groupedItems.map(group => {
              const isCollapsed = collapsedSubgroups.has(group.key);
              const groupCartCount = group.items.reduce((sum, item) => {
                const cartItem = cartItems.find(ci => ci.product_id === item.id);
                return sum + (cartItem ? cartItem.qty : 0);
              }, 0);

              return (
                <div key={group.key}>
                  {/* Subgroup header */}
                  <button
                    onClick={() => toggleSubgroup(group.key)}
                    className="w-full flex items-center justify-between px-1 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <h2 className="font-black text-sm text-foreground">{group.label}</h2>
                      <span className="text-[10px] text-muted-foreground bg-secondary border border-border px-2 py-0.5 rounded-full">
                        {group.items.length}
                      </span>
                      {groupCartCount > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] font-bold text-primary bg-blue-50 px-2 py-0.5 rounded-full border border-border">
                          <ShoppingCart className="w-2.5 h-2.5" /> {groupCartCount}
                        </span>
                      )}
                    </div>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                  </button>

                  {!isCollapsed && (
                    <div className="grid grid-cols-2 gap-2.5">
                      {group.items.map(item => {
                        const qty = getCartQty(item.id);
                        const inCart = qty > 0;

                        return (
                          <div
                            key={item.id}
                            className={`bg-card rounded-2xl overflow-hidden transition-all ${
                              inCart
                                ? 'border-2 border-accent shadow-lg shadow-accent/15'
                                : 'border border-border shadow-sm'
                            }`}
                          >
                            {/* Image area */}
                            <div className="relative h-24 bg-gradient-to-br from-secondary to-[#DBEFF9] flex items-center justify-center">
                              {item.image_url && !brokenImg.has(item.id) ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={item.image_url}
                                  alt={item.name}
                                  loading="lazy"
                                  className="w-full h-full object-cover"
                                  onError={() => setBrokenImg(prev => { const n = new Set(prev); n.add(item.id); return n; })}
                                />
                              ) : item.family_key === 'KOLD' ? (
                                <Package className="w-10 h-10 text-primary/30" />
                              ) : (
                                <Snowflake className="w-10 h-10 text-primary/30" />
                              )}
                              {inCart && (
                                <span className="absolute top-0 right-0 bg-accent text-white text-[7px] font-black px-2 py-1 rounded-bl-xl tracking-wide">
                                  EN CARRITO
                                </span>
                              )}
                            </div>

                            {/* Body */}
                            <div className="p-2.5">
                              <h3
                                className={`text-[10px] font-bold leading-tight mb-1 min-h-[28px] ${inCart ? 'text-accent' : 'text-foreground'}`}
                                title={item.name}
                              >
                                {item.name}
                              </h3>
                              <div className="flex items-center gap-1 mb-1.5">
                                <span className="text-[8px] text-muted-foreground">{item.uom}</span>
                                {item.boxSize > 1 && (
                                  <span className="text-[8px] font-bold text-primary bg-secondary border border-border px-1.5 rounded-full">
                                    ×{item.boxSize}
                                  </span>
                                )}
                              </div>
                              <p className={`text-[15px] font-black mb-2 ${inCart ? 'text-primary' : 'text-foreground'}`}>
                                ${item.price.toFixed(2)}
                              </p>

                              {/* +/- controls */}
                              <div className="flex items-center justify-between">
                                <button
                                  onClick={() => handleDecrement(item)}
                                  className={`w-[30px] h-[30px] rounded-lg flex items-center justify-center text-lg font-bold transition-colors ${
                                    inCart
                                      ? 'bg-blue-100 text-accent border-none'
                                      : 'border border-border bg-card text-muted-foreground'
                                  }`}
                                >
                                  −
                                </button>
                                <span className={`text-sm font-black w-6 text-center ${inCart ? 'text-accent' : 'text-foreground'}`}>
                                  {qty}
                                </span>
                                <button
                                  onClick={() => handleIncrement(item)}
                                  className="w-[30px] h-[30px] rounded-lg bg-primary text-white flex items-center justify-center text-lg font-bold"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating cart bar */}
      {totalCartItems > 0 && (
        <Link
          href="/cart"
          className="fixed bottom-20 left-3 right-3 bg-gradient-to-r from-primary to-accent text-white rounded-2xl px-4 py-3 shadow-xl shadow-primary/35 flex items-center justify-between z-30"
        >
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" />
            <span className="font-bold text-sm">{totalCartItems} producto{totalCartItems !== 1 ? 's' : ''}</span>
          </div>
          <span className="font-black text-sm">${totalCartValue.toFixed(2)} →</span>
        </Link>
      )}
    </div>
  );
}
