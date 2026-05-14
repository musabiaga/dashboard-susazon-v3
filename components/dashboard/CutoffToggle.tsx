"use client";

/**
 * CutoffToggle — selector entre "Cierre [última fecha con venta]" y
 * "Hoy [día calendario actual]".
 *
 * Resuelve el desfase data-vs-calendario:
 *   - Si refrescas a las 9 AM, la última factura puede ser de ayer
 *   - El sistema entonces compara venta(ayer) vs meta(hoy) → "REZAGADO"
 *   - Con este toggle el usuario puede ver "como cerró ayer" sin desfase
 *
 * Solo se renderiza si hay diferencia entre lastDayWithSale y actualTodayDay.
 * En histórico nunca se muestra.
 *
 * Click navega a /dashboard?asOf=YYYY-MM-DD (cierre) o quita el param (hoy).
 * Re-renderiza el server component completo con el nuevo daysCurrent →
 * todos los cálculos (KPIs, al-día año anterior, run-rate, etc.) se ajustan.
 */

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Clock } from "lucide-react";

const MONTH_SHORT_ES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

interface Props {
  /** Año del mes mostrado (debería ser el mes actual; toggle no aplica histórico). */
  currentYear: number;
  /** Mes mostrado (1-12). */
  currentMonth: number;
  /** Día calendario "hoy" CDMX. */
  actualTodayDay: number;
  /** Último día del mes con venta > 0 (calculado en server desde dailyCurrent).
   *  null = no hay venta este mes todavía. */
  lastDayWithSale: number;
  /** Día actualmente seleccionado vía ?asOf=. null = "Hoy" (default). */
  asOfDay: number | null;
}

export function CutoffToggle({
  currentYear,
  currentMonth,
  actualTodayDay,
  lastDayWithSale,
  asOfDay,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const monthShort = MONTH_SHORT_ES[currentMonth - 1];
  const cierreLabel = `Cierre ${lastDayWithSale}-${monthShort}`;
  const hoyLabel = `Hoy ${actualTodayDay}-${monthShort}`;

  // El "cierre" está activo si hay asOf y coincide con lastDayWithSale.
  const isCierreActive = asOfDay === lastDayWithSale;

  function navigate(newAsOf: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (newAsOf) params.set("asOf", newAsOf);
    else params.delete("asOf");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
    router.refresh();
  }

  function handleCierre() {
    if (isCierreActive) return;
    // Construir fecha ISO YYYY-MM-DD del último día con venta
    const yyyy = String(currentYear);
    const mm = String(currentMonth).padStart(2, "0");
    const dd = String(lastDayWithSale).padStart(2, "0");
    navigate(`${yyyy}-${mm}-${dd}`);
  }

  function handleHoy() {
    if (!isCierreActive && asOfDay === null) return;
    navigate(null);
  }

  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-[var(--radius)] border p-0.5"
      style={{
        background: "var(--bg-surface-muted)",
        borderColor: "var(--border)",
      }}
      title="Cambia el día de corte para comparar venta acumulada contra la meta de ese día (resuelve el desfase data-vs-calendario)"
    >
      <Clock
        size={12}
        className="ml-1.5 mr-0.5"
        style={{ color: "var(--text-muted)" }}
      />
      <button
        type="button"
        onClick={handleCierre}
        className="rounded-[var(--radius-sm)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors"
        style={{
          background: isCierreActive ? "var(--bg-surface)" : "transparent",
          color: isCierreActive ? "var(--accent)" : "var(--text-muted)",
          boxShadow: isCierreActive ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
        }}
      >
        {cierreLabel}
      </button>
      <button
        type="button"
        onClick={handleHoy}
        className="rounded-[var(--radius-sm)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors"
        style={{
          background: !isCierreActive ? "var(--bg-surface)" : "transparent",
          color: !isCierreActive ? "var(--accent)" : "var(--text-muted)",
          boxShadow: !isCierreActive ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
        }}
      >
        {hoyLabel}
      </button>
    </div>
  );
}
