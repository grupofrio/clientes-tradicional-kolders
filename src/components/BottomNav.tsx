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
        if (!data.error && Array.isArray(data)) {
          setHasDebt(data.some((inv: any) => new Date(inv.invoice_date_due) < new Date()));
        }
      })
      .catch(() => {});
  }, [pathname]);

  const navItems = [
    { name: "Catálogo", href: "/catalog", icon: Package },
    { name: "Carrito", href: "/cart", icon: ShoppingCart, badge: mounted ? totalItems : 0 },
    { name: "Pedidos", href: "/account/orders", icon: ClipboardList },
    { name: "Cuenta", href: "/account", icon: User, showDot: hasDebt },
  ];

  return (
    <div className="fixed bottom-0 left-0 w-full bg-card border-t border-border px-6 py-2 pb-7 z-50 flex justify-between shadow-2xl">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname.startsWith(item.href);

        return (
          <Link
            key={item.name}
            href={item.href}
            className={`flex flex-col items-center gap-1 relative transition-colors ${
              isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <div className="relative">
              <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
              {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute -top-2 -right-3 bg-danger text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-md">
                  {item.badge}
                </span>
              )}
              {item.showDot && (
                <span className="absolute -top-1 right-0 w-2.5 h-2.5 bg-danger rounded-full border-2 border-white shadow-sm" />
              )}
            </div>
            <span className={`text-[9px] tracking-wide ${isActive ? "font-bold text-primary" : "font-medium"}`}>
              {item.name}
            </span>
            {isActive && <span className="w-1 h-1 bg-primary rounded-full" />}
          </Link>
        );
      })}
    </div>
  );
}
