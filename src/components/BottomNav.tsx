"use client";
import { useB2BCartStore } from "@/store/cart";
import { Package, ShoppingCart, User, ClipboardList } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function BottomNav() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [hasDebt, setHasDebt] = useState(false);
  const totalItems = useB2BCartStore((state) => state.getTotalItems());

  useEffect(() => {
    setMounted(true);
    fetch('/api/b2b/invoices')
      .then(res => res.json())
      .then(data => {
         if(!data.error && Array.isArray(data)) {
             setHasDebt(data.some((inv: any) => new Date(inv.invoice_date_due) < new Date()));
         }
      })
      .catch(() => {});
  }, [pathname]); // Refresh en cambio de ruta 

  const navItems = [
    { name: "Catálogo", href: "/catalog", icon: Package },
    { name: "Carrito", href: "/cart", icon: ShoppingCart, badge: mounted ? totalItems : 0 },
    { name: "Pedidos", href: "/account/orders", icon: ClipboardList },
    { name: "Cuenta", href: "/account", icon: User, showDot: hasDebt },
  ];

  return (
    <div className="fixed bottom-0 left-0 w-full bg-card border-t border-border px-6 py-3 pb-8 z-50 flex justify-between shadow-2xl">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname.startsWith(item.href);

        return (
          <Link
            key={item.name}
            href={item.href}
            className={`flex flex-col items-center gap-1 relative transition-colors ${
              isActive ? "text-primary scale-110" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <div className="relative">
              <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
              {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute -top-2 -right-3 bg-danger text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center shadow-md">
                  {item.badge}
                </span>
              )}
              {item.showDot && (
                 <span className="absolute -top-1 right-0 w-3 h-3 bg-danger rounded-full border-2 border-white shadow-sm"></span>
              )}
            </div>
            <span className={`text-[10px] font-medium tracking-wide ${isActive ? "font-bold" : ""}`}>
              {item.name}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
