"use client";
import { Loader2, RefreshCw, Plus, X } from "lucide-react";

interface ReorderConfirmModalProps {
  open: boolean;
  busy?: boolean;
  onReplace: () => void;
  onAdd: () => void;
  onCancel: () => void;
}

/**
 * Confirmación mostrada cuando el cliente toca "Repetir pedido" y el carrito
 * YA tiene productos — evita duplicar cantidades por accidente. Le deja elegir
 * entre reemplazar el carrito o sumar al existente. Estilo Grupo Frío,
 * mobile-first (hoja inferior en móvil, centrada en pantallas grandes).
 */
export default function ReorderConfirmModal({
  open,
  busy = false,
  onReplace,
  onAdd,
  onCancel,
}: ReorderConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-sm rounded-3xl p-6 shadow-2xl relative animate-in slide-in-from-bottom-8">
        <button
          onClick={onCancel}
          disabled={busy}
          aria-label="Cerrar"
          className="absolute top-4 right-4 text-muted-foreground disabled:opacity-40"
        >
          <X size={20} />
        </button>

        <h2 className="text-lg font-black text-foreground mb-2 pr-6">
          Ya tienes productos en tu carrito
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          ¿Quieres reemplazarlos con tu pedido de siempre o agregarlos al carrito
          que ya tienes?
        </p>

        <div className="space-y-2.5">
          <button
            onClick={onReplace}
            disabled={busy}
            className="w-full h-13 py-3.5 rounded-2xl bg-gradient-to-r from-primary to-accent text-white font-black tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-primary/25 active:scale-[0.98] transition-all disabled:opacity-60"
          >
            {busy ? <Loader2 className="animate-spin w-5 h-5" /> : <><RefreshCw size={17} /> Reemplazar carrito</>}
          </button>
          <button
            onClick={onAdd}
            disabled={busy}
            className="w-full py-3 rounded-2xl border border-border text-foreground font-bold text-sm flex items-center justify-center gap-2 active:bg-muted/50 transition-colors disabled:opacity-60"
          >
            <Plus size={16} /> Agregar al carrito
          </button>
          <button
            onClick={onCancel}
            disabled={busy}
            className="w-full py-3 rounded-2xl text-muted-foreground font-bold text-sm active:bg-muted/50 transition-colors disabled:opacity-60"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
