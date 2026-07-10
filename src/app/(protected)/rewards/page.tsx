"use client";
// Ruta /rewards — v1 "Próximamente". SIN fetch, SIN Odoo, SIN endpoint.
// Visibilidad gateada por NEXT_PUBLIC_REWARDS_MODE (ver src/lib/rewardsMode.ts).
// Si el módulo no está visible (off / dry_run / real / desconocido), redirige a
// /home para no dejar la ruta huérfana.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import RewardsSummary from "@/components/RewardsSummary";
import { rewardsVisibleV1 } from "@/lib/rewardsMode";

export default function RewardsPage() {
  const router = useRouter();
  const visible = rewardsVisibleV1();

  useEffect(() => {
    if (!visible) router.replace("/home");
  }, [visible, router]);

  if (!visible) return null;

  return (
    <div className="p-5 pb-28 max-w-md mx-auto">
      <h2 className="font-black text-foreground text-base mb-4">Recompensas</h2>
      <RewardsSummary variant="page" />
    </div>
  );
}
