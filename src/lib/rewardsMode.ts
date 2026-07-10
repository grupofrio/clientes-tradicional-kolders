// Rewards PWA v1 — control del módulo visual "Próximamente" por flag de front.
//
// Fuente de verdad ÚNICA del estado de rewards en la PWA. NO llama a Odoo, NO
// hace fetch, NO maneja saldo/puntos/canje. Solo decide si se muestra la card
// "coming soon" de v1.
//
// Flag: NEXT_PUBLIC_REWARDS_MODE (build-time, inlined por Next).
//   - unset / "coming_soon" -> coming_soon (v1 VISIBLE)
//   - "off"                 -> oculto
//   - "dry_run" / "real"    -> reservados a fases futuras; en v1 NO activan nada
//                              (se tratan como NO visibles para fallar seguro)
//   - cualquier valor desconocido -> "off" (fail-safe)

export type RewardsMode = "coming_soon" | "off" | "dry_run" | "real";

const KNOWN_MODES: readonly RewardsMode[] = ["coming_soon", "off", "dry_run", "real"];

/**
 * Normaliza el valor crudo del flag a un RewardsMode.
 * Vacío/undefined -> "coming_soon" (default v1). Desconocido -> "off" (fail-safe).
 */
export function getRewardsMode(raw?: string | null): RewardsMode {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "") return "coming_soon";
  return (KNOWN_MODES as readonly string[]).includes(value)
    ? (value as RewardsMode)
    : "off";
}

/**
 * v1: SOLO el modo "coming_soon" (o unset) muestra contenido. "off",
 * "dry_run", "real" y valores desconocidos quedan ocultos en v1 — v1 no
 * implementa saldo/dry-run/real, así que degradan a oculto (activan nada).
 */
export function isRewardsVisibleV1(raw?: string | null): boolean {
  return getRewardsMode(raw) === "coming_soon";
}

/** Lee el flag del entorno (NEXT_PUBLIC_REWARDS_MODE) y resuelve visibilidad v1. */
export function rewardsVisibleV1(): boolean {
  return isRewardsVisibleV1(process.env.NEXT_PUBLIC_REWARDS_MODE);
}
