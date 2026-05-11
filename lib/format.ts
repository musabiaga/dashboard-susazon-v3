/**
 * Helpers de formateo (portado del V2.2 + adaptaciones).
 *
 * 2026-05-10: precisión mejorada — K y M con 2 decimales (antes K=0, M=1).
 * Decisión de Mauricio para data ejecutiva más fina sin perder compactidad.
 */

export function formatMoney(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return "$0";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(2)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

export function formatKilos(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return "0";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(2)}K`;
  return `${sign}${abs.toFixed(0)}`;
}

/**
 * Formato exacto (sin abreviar) — usado cuando se necesita el número completo.
 * Ej: $2,419,873 / 857,341.
 */
export function formatMoneyExact(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return "$0";
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toLocaleString("es-MX", { maximumFractionDigits: 0 })}`;
}

export function formatKilosExact(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return "0";
  const sign = value < 0 ? "-" : "";
  return `${sign}${Math.abs(value).toLocaleString("es-MX", { maximumFractionDigits: 0 })}`;
}

export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value == null || isNaN(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(decimals)}%`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
