"use client";

import { useMemo } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatMoney, formatKilos } from "@/lib/format";
import { countBizDays, isBusinessDay } from "@/lib/business-days";
import type { TerritoryKpi } from "@/components/dashboard/Sidebar";

const DOW_ES = ["D", "L", "M", "Mi", "J", "V", "S"];
const MONTH_SHORT_LOWER = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

interface Props {
  kpi: TerritoryKpi;
  ventaBudget: number;
  currentYear: number;
  currentMonth: number; // 1-12
  monthShortYY: string;
  prevMonthShortYY: string;
  elapsedBizDays: number;
  totalBizDays: number;
}

export function TrackingDiarioTab({
  kpi,
  ventaBudget,
  currentYear,
  currentMonth,
  monthShortYY,
  prevMonthShortYY,
  elapsedBizDays,
  totalBizDays,
}: Props) {
  // ============ Cálculos KPI (verbatim del V2.2) ============
  const acum = kpi.venta;
  const marginMoney = kpi.margen;
  const marginPct = kpi.marginPct;
  const prevYearVenta = kpi.prevYear.venta;
  const ptto = ventaBudget;
  const remainingBizDays = Math.max(0, totalBizDays - elapsedBizDays);

  const velOrig = totalBizDays > 0 ? ptto / totalBizDays : 0;
  const velActual = elapsedBizDays > 0 ? acum / elapsedBizDays : 0;
  const velNeces =
    remainingBizDays > 0 ? Math.max(0, (ptto - acum) / remainingBizDays) : 0;
  const runRate = velActual * totalBizDays;
  const runRatePct = ptto > 0 ? (runRate / ptto) * 100 : 0;
  const alcancePct = ptto > 0 ? (acum / ptto) * 100 : 0;
  const faltante = Math.max(0, ptto - acum);
  const yoyCh =
    prevYearVenta > 0 ? ((acum - prevYearVenta) / prevYearVenta) * 100 : 0;
  const tiempoPct =
    totalBizDays > 0 ? (elapsedBizDays / totalBizDays) * 100 : 0;
  const brechaPp = alcancePct - tiempoPct;

  // Días hábiles con factura (venta > 0)
  const daysWithInvoice = kpi.daily.current.filter((p) =>
    isBusinessDay(new Date(currentYear, currentMonth - 1, p.d))
  ).length;

  // ============ Chart data ============
  const chartData = useMemo(() => {
    const allDays = new Set<number>();
    for (const p of kpi.daily.current) allDays.add(p.d);
    for (const p of kpi.daily.prevYear) allDays.add(p.d);
    const sorted = Array.from(allDays).sort((a, b) => a - b);

    const currentByDay = new Map(kpi.daily.current.map((p) => [p.d, p.v]));
    const prevByDay = new Map(kpi.daily.prevYear.map((p) => [p.d, p.v]));

    let cumC = 0;
    let cumP = 0;
    return sorted.map((d) => {
      cumC += currentByDay.get(d) ?? 0;
      cumP += prevByDay.get(d) ?? 0;
      const bizElapsedHere = countBizDays(currentYear, currentMonth, d);
      const pttoLinearHere =
        totalBizDays > 0 ? ptto * (bizElapsedHere / totalBizDays) : 0;
      return {
        day: d,
        ventaDiaria: currentByDay.get(d) ?? 0,
        acumulado: cumC,
        pttoLinear: pttoLinearHere,
        anoAnterior: cumP,
      };
    });
  }, [kpi.daily, currentYear, currentMonth, totalBizDays, ptto]);

  // ============ Tabla diaria ============
  const tableRows = useMemo(() => {
    const sorted = [...kpi.daily.current].sort((a, b) => a.d - b.d);
    let cumV = 0;
    return sorted.map((p) => {
      cumV += p.v;
      const date = new Date(currentYear, currentMonth - 1, p.d);
      const bizElapsedHere = countBizDays(currentYear, currentMonth, p.d);
      const remainingBizHere = Math.max(0, totalBizDays - bizElapsedHere);
      const velNecesHere =
        remainingBizHere > 0
          ? Math.max(0, (ptto - cumV) / remainingBizHere)
          : 0;
      const pctPtto = ptto > 0 ? (cumV / ptto) * 100 : 0;
      const marginPctRow = p.v > 0 ? (p.m / p.v) * 100 : 0;
      const velNecesTone: "success" | "warning" | "danger" =
        velNecesHere <= velOrig
          ? "success"
          : velNecesHere <= velOrig * 1.2
            ? "warning"
            : "danger";
      return {
        d: p.d,
        date,
        dow: DOW_ES[date.getDay()],
        venta: p.v,
        acum: cumV,
        pctPtto,
        velNeces: velNecesHere,
        velNecesTone,
        margen: p.m,
        marginPct: marginPctRow,
        kg: p.k,
      };
    });
  }, [kpi.daily, currentYear, currentMonth, totalBizDays, ptto, velOrig]);

  // ============ Render ============
  const hasPtto = ptto > 0;
  const hasPrev = prevYearVenta > 0;
  const velActualTone =
    elapsedBizDays > 0 && velActual >= velOrig
      ? "var(--success)"
      : "var(--danger)";
  const velNecesTone =
    velNeces <= velOrig
      ? "var(--success)"
      : velNeces <= velOrig * 1.2
        ? "var(--warning)"
        : "var(--danger)";
  const progressTone =
    brechaPp >= 0
      ? "var(--success)"
      : brechaPp >= -5
        ? "var(--warning)"
        : "var(--danger)";
  const brechaLabel = brechaPp >= 0 ? "AVANZADO" : "REZAGADO";

  return (
    <div className="space-y-4">
      {/* ============ 8 stats grid (6 + 2) ============ */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat
          label="Venta del Mes"
          value={formatMoney(acum)}
          sub={`Día ${elapsedBizDays} de ${totalBizDays} · ${daysWithInvoice} con factura`}
        />
        <Stat
          label="Alcance Ptto"
          value={hasPtto ? `${alcancePct.toFixed(1)}%` : "—"}
          sub={hasPtto ? `${formatMoney(faltante)} faltante` : "Sin PTTO"}
        />
        <Stat
          label="Margen $"
          value={formatMoney(marginMoney)}
          sub={`${marginPct.toFixed(1)}%`}
        />
        <Stat
          label="vs Mismo Mes Año Ant."
          value={
            hasPrev
              ? `${yoyCh >= 0 ? "+" : ""}${yoyCh.toFixed(1)}%`
              : "—"
          }
          valueTone={hasPrev ? (yoyCh >= 0 ? "success" : "danger") : "neutral"}
          sub={hasPrev ? `vs ${formatMoney(prevYearVenta)}` : "Sin data año ant."}
        />
        <Stat
          label="Vel. Original"
          value={hasPtto ? formatMoney(velOrig) : "—"}
          sub="meta/día"
        />
        <Stat
          label="Vel. Actual"
          value={formatMoney(velActual)}
          valueTone={
            hasPtto ? (velActual >= velOrig ? "success" : "danger") : "neutral"
          }
          sub="meta/día"
        />
        <Stat
          label="Vel. Necesaria"
          value={hasPtto ? formatMoney(velNeces) : "—"}
          valueTone={
            hasPtto
              ? velNeces <= velOrig
                ? "success"
                : velNeces <= velOrig * 1.2
                  ? "warning"
                  : "danger"
              : "neutral"
          }
          sub="meta/día"
        />
        <Stat
          label="Run Rate"
          value={formatMoney(runRate)}
          sub={hasPtto ? `${runRatePct.toFixed(0)}% del ptto` : "Sin PTTO"}
        />
      </div>

      {/* ============ Progress bar ============ */}
      {hasPtto && (
        <div
          className="rounded-[var(--radius-lg)] border p-4"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border)",
          }}
        >
          <div
            className="relative h-9 w-full overflow-hidden rounded-[var(--radius)]"
            style={{ background: "var(--bg-surface-muted)" }}
          >
            {/* Filled */}
            <div
              className="flex h-full items-center justify-center text-xs font-semibold text-white transition-all"
              style={{
                width: `${Math.min(100, alcancePct)}%`,
                background: progressTone,
              }}
            >
              {alcancePct >= 8 && (
                <span>
                  {formatMoney(acum)} ({alcancePct.toFixed(0)}%)
                </span>
              )}
            </div>
            {/* Total label on right */}
            <span
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              {formatMoney(ptto)}
            </span>
            {/* Día marker */}
            {tiempoPct > 0 && tiempoPct < 100 && (
              <div
                className="absolute top-0 h-full border-l-2 border-dashed"
                style={{
                  left: `${tiempoPct}%`,
                  borderColor: "var(--text-primary)",
                }}
              >
                <span
                  className="absolute -top-5 -translate-x-1/2 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
                  style={{ background: "var(--text-primary)" }}
                >
                  Día {elapsedBizDays}/{totalBizDays}
                </span>
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span
              className="font-semibold"
              style={{ color: progressTone }}
            >
              {brechaLabel} {brechaPp >= 0 ? "+" : ""}
              {brechaPp.toFixed(0)}pp
              <span
                className="ml-2 font-normal"
                style={{ color: "var(--text-secondary)" }}
              >
                — Venta: {alcancePct.toFixed(0)}% · Tiempo: {tiempoPct.toFixed(0)}%
              </span>
            </span>
            <span style={{ color: "var(--text-secondary)" }}>
              {remainingBizDays} día(s) restante(s) · Necesario:{" "}
              <strong style={{ color: velNecesTone }}>
                {formatMoney(velNeces)}/día
              </strong>
            </span>
          </div>
        </div>
      )}

      {/* ============ Chart ============ */}
      <div
        className="rounded-[var(--radius-lg)] border p-4"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
        }}
      >
        {chartData.length === 0 ? (
          <p
            className="py-12 text-center text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            Sin data del mes para graficar.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart
              data={chartData}
              margin={{ top: 20, right: 60, bottom: 5, left: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                stroke="var(--border-strong)"
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                stroke="var(--border-strong)"
                tickFormatter={(v) =>
                  v >= 1_000_000
                    ? `${(v / 1_000_000).toFixed(1)}M`
                    : v >= 1_000
                      ? `${(v / 1_000).toFixed(0)}K`
                      : `${v}`
                }
                label={{
                  value: "Venta Diaria",
                  angle: -90,
                  position: "insideLeft",
                  style: { fill: "var(--text-muted)", fontSize: 10 },
                }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                stroke="var(--border-strong)"
                tickFormatter={(v) =>
                  v >= 1_000_000
                    ? `${(v / 1_000_000).toFixed(1)}M`
                    : v >= 1_000
                      ? `${(v / 1_000).toFixed(0)}K`
                      : `${v}`
                }
                label={{
                  value: "Acumulado",
                  angle: 90,
                  position: "insideRight",
                  style: { fill: "var(--text-muted)", fontSize: 10 },
                }}
              />
              <Tooltip
                content={
                  <TrackingDiarioTooltip
                    currentMonthIdx={currentMonth - 1}
                    prevMonthShortYY={prevMonthShortYY}
                  />
                }
                cursor={{
                  stroke: "var(--text-muted)",
                  strokeWidth: 1,
                  strokeDasharray: "3 3",
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 12 }}
                iconType="line"
              />
              <Bar
                yAxisId="left"
                dataKey="ventaDiaria"
                name="Venta Diaria"
                fill="rgba(59, 130, 246, 0.4)"
                radius={[2, 2, 0, 0]}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="acumulado"
                name="Acumulado"
                stroke="#1e3a8a"
                strokeWidth={2.5}
                dot={{ r: 3, strokeWidth: 1, fill: "white" }}
              />
              {hasPtto && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="pttoLinear"
                  name="Ptto Linear"
                  stroke="#a855f7"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={{ r: 3, strokeWidth: 1, fill: "white" }}
                />
              )}
              {hasPrev && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="anoAnterior"
                  name={`Año Anterior (${prevMonthShortYY})`}
                  stroke="#94a3b8"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={{ r: 3, strokeWidth: 1, fill: "white" }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ============ Tabla diaria ============ */}
      {tableRows.length > 0 && (
        <div
          className="rounded-[var(--radius-lg)] border"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border)",
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs tabular-nums">
              <thead>
                <tr style={{ background: "var(--bg-surface-muted)" }}>
                  <Th>Día</Th>
                  <Th>Fecha</Th>
                  <Th align="right">Venta Diaria</Th>
                  <Th align="right">Acumulado</Th>
                  <Th align="right">% Ptto</Th>
                  <Th align="right">Vel. Necesaria</Th>
                  <Th align="right">Margen $</Th>
                  <Th align="right">Margen %</Th>
                  <Th align="right">KG</Th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row, i) => (
                  <tr
                    key={row.d}
                    style={{
                      background:
                        i % 2 === 0
                          ? "var(--bg-surface)"
                          : "var(--bg-surface-muted)",
                    }}
                  >
                    <Td>{row.dow}</Td>
                    <Td>
                      {row.d} {MONTH_SHORT_LOWER[row.date.getMonth()]}
                    </Td>
                    <Td align="right">{formatMoney(row.venta)}</Td>
                    <Td align="right">{formatMoney(row.acum)}</Td>
                    <Td align="right">{row.pctPtto.toFixed(1)}%</Td>
                    <Td
                      align="right"
                      color={`var(--${row.velNecesTone})`}
                      bold
                    >
                      {hasPtto ? formatMoney(row.velNeces) : "—"}
                    </Td>
                    <Td align="right">{formatMoney(row.margen)}</Td>
                    <Td align="right">{row.marginPct.toFixed(1)}%</Td>
                    <Td align="right">{formatKilos(row.kg)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Sub-components ============

function Stat({
  label,
  value,
  sub,
  valueTone = "neutral",
}: {
  label: string;
  value: string;
  sub: string;
  valueTone?: "neutral" | "success" | "warning" | "danger";
}) {
  const valueColor =
    valueTone === "success"
      ? "var(--success)"
      : valueTone === "warning"
        ? "var(--warning)"
        : valueTone === "danger"
          ? "var(--danger)"
          : "var(--text-primary)";
  return (
    <div
      className="rounded-[var(--radius-lg)] border px-4 py-3"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div
        className="text-[10px] font-medium uppercase tracking-wider"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </div>
      <div
        className="mt-1.5 text-xl font-bold tabular-nums"
        style={{ color: valueColor }}
      >
        {value}
      </div>
      <div
        className="mt-0.5 text-[11px]"
        style={{ color: "var(--text-muted)" }}
      >
        {sub}
      </div>
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      className={`border-b px-3 py-2 font-semibold uppercase tracking-wider text-[10px] text-${align}`}
      style={{
        borderColor: "var(--border)",
        color: "var(--text-secondary)",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
  color,
  bold = false,
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
  color?: string;
  bold?: boolean;
}) {
  return (
    <td
      className={`px-3 py-1.5 text-${align}`}
      style={{
        color: color ?? "var(--text-primary)",
        fontWeight: bold ? 600 : 400,
      }}
    >
      {children}
    </td>
  );
}

// ============================================================
// TrackingDiarioTooltip — alineado al UI moderno del tab Ventas
// ============================================================
// Header: "DÍA X — D MMM" + delta YoY del acumulado (▲/▼ vs Día X mes año ant.)
// Cuerpo: Row por cada serie del chart con bullet color + label + valor.
// Datos: vienen del payload de Recharts (chartData), respetando misma info
// que ya se mostraba; solo cambia presentación.
interface TooltipPayloadItem {
  name?: string;
  value?: number | null;
  color?: string;
  dataKey?: string;
}

function TrackingDiarioTooltip({
  active,
  payload,
  label,
  currentMonthIdx,
  prevMonthShortYY,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
  currentMonthIdx: number;
  prevMonthShortYY: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const dayNum = typeof label === "number" ? label : Number(label);
  const monthLower = MONTH_SHORT_LOWER[currentMonthIdx] ?? "";

  // Buscar acumulado actual y año anterior para el delta YoY
  const acumActual = payload.find((p) => p.dataKey === "acumulado")?.value;
  const acumPrev = payload.find((p) => p.dataKey === "anoAnterior")?.value;
  const yoyDelta =
    typeof acumActual === "number" &&
    typeof acumPrev === "number" &&
    acumPrev > 0
      ? ((acumActual - acumPrev) / acumPrev) * 100
      : null;

  // Mantener orden visual: Venta Diaria, Acumulado, Ptto Linear, Año Anterior
  const orderedKeys = ["ventaDiaria", "acumulado", "pttoLinear", "anoAnterior"];
  const ordered = orderedKeys
    .map((k) => payload.find((p) => p.dataKey === k))
    .filter((p): p is TooltipPayloadItem => p != null);

  return (
    <div
      className="overflow-hidden rounded-[var(--radius)] border text-xs tabular-nums shadow-lg"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border-strong)",
        minWidth: 240,
        boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-baseline justify-between gap-3 px-3 py-2"
        style={{
          background: "var(--bg-surface-muted)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <span
          className="text-[11px] font-bold uppercase tracking-wider"
          style={{ color: "var(--text-primary)" }}
        >
          Día {dayNum} — {dayNum} {monthLower}
        </span>
        {yoyDelta != null && (
          <span
            className="text-[10px] font-semibold whitespace-nowrap"
            style={{
              color: yoyDelta >= 0 ? "var(--success)" : "var(--danger)",
            }}
          >
            {yoyDelta >= 0 ? "▲" : "▼"} {Math.abs(yoyDelta).toFixed(1)}% vs Día{" "}
            {dayNum} {prevMonthShortYY}
          </span>
        )}
      </div>

      {/* Cuerpo: una sola sección con todas las series */}
      <div className="px-3 py-2">
        {ordered.map((p) => (
          <TtRow
            key={p.dataKey}
            color={p.color}
            label={p.name ?? ""}
            value={
              typeof p.value === "number" ? formatMoney(p.value) : "—"
            }
          />
        ))}
      </div>
    </div>
  );
}

function TtRow({
  color,
  label,
  value,
}: {
  color: string | undefined;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-0.5">
      <span className="flex items-center gap-2">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ background: color ?? "var(--text-muted)" }}
        />
        <span style={{ color: "var(--text-secondary)" }}>{label}</span>
      </span>
      <span
        className="font-semibold"
        style={{ color: "var(--text-primary)" }}
      >
        {value}
      </span>
    </div>
  );
}
