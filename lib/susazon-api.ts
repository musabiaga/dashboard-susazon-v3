/**
 * Wrapper server-side de la API REST de Susazón.
 * NUNCA importar desde Client Components — la API key vive en process.env.
 */

export interface SusazonRow {
  empresa: number; // 0=Susazón, 1=Suve
  no_cliente: string;
  cliente: string;
  territorio: string;
  vendedor: string;
  sku: string;
  kg: number;
  fecha: string; // YYYY-MM-DD
  anio: number;
  mes: number;
  venta: number;
  margen: number;
  familia: string | null;
  grupo: string | null; // Campo nuevo abr 2026
}

export interface MonthFetchResult {
  desde: string;
  hasta: string;
  rows: SusazonRow[];
  pagesFetched: number;
  totalPages: number;
  error?: string;
}

const PAGE_SIZE = 50000;
const FETCH_TIMEOUT_MS = 45_000;

/**
 * Limpia trailing HTML/garbage que la API a veces incluye después del JSON.
 */
function cleanResponseText(text: string): string {
  const docTypeIdx = text.indexOf("<!DOCTYPE");
  if (docTypeIdx > 0) return text.substring(0, docTypeIdx).trim();
  const htmlIdx = text.indexOf("<html");
  if (htmlIdx > 0) return text.substring(0, htmlIdx).trim();
  return text.trim();
}

/**
 * Fetch con timeout — Susazón a veces se cuelga.
 */
async function fetchWithTimeout(url: string, init: RequestInit, ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Trae todas las filas de un mes específico (paginadas).
 * Tolerante a fallos: si una página falla, continúa con la siguiente.
 */
export async function fetchSusazonMonth(
  year: number,
  month: number
): Promise<MonthFetchResult> {
  const url = process.env.SUSAZON_API_URL!;
  const apiKey = process.env.SUSAZON_API_KEY!;
  if (!url || !apiKey) {
    throw new Error("SUSAZON_API_URL y SUSAZON_API_KEY deben estar configurados");
  }

  const desde = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const hasta = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const allRows: SusazonRow[] = [];
  let page = 1;
  let totalPages = 1;
  let lastError: string | undefined;

  while (page <= totalPages) {
    try {
      const res = await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-KEY": apiKey,
          },
          body: JSON.stringify({
            page,
            page_size: PAGE_SIZE,
            desde,
            hasta,
          }),
        },
        FETCH_TIMEOUT_MS
      );

      if (!res.ok) {
        lastError = `HTTP ${res.status} en página ${page}`;
        break;
      }

      const rawText = await res.text();
      const cleaned = cleanResponseText(rawText);

      let parsed: { status?: string; total_paginas?: number; data?: SusazonRow[] };
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        lastError = `JSON inválido en página ${page}`;
        break;
      }

      if (parsed.total_paginas) totalPages = parsed.total_paginas;

      const rows = Array.isArray(parsed.data) ? parsed.data : [];
      allRows.push(...rows);

      if (rows.length < PAGE_SIZE) break; // optimización: si no llenamos página, no hay más
      page++;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      break;
    }
  }

  return {
    desde,
    hasta,
    rows: allRows,
    pagesFetched: page - 1,
    totalPages,
    error: lastError,
  };
}

/**
 * Genera la lista de meses (year, month) entre dos fechas inclusive.
 */
export function monthsBetween(
  fromYear: number,
  fromMonth: number,
  toYear: number,
  toMonth: number
): Array<{ year: number; month: number }> {
  const out: Array<{ year: number; month: number }> = [];
  let y = fromYear;
  let m = fromMonth;
  while (y < toYear || (y === toYear && m <= toMonth)) {
    out.push({ year: y, month: m });
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

/**
 * Filtra filas válidas según las reglas del V2.2:
 * - kg > 0 (descartar líneas sin volumen)
 * - anio >= 2024
 */
export function filterValidRows(rows: SusazonRow[]): SusazonRow[] {
  return rows.filter((r) => {
    const kg = Number(r.kg);
    const anio = Number(r.anio);
    return !isNaN(kg) && kg > 0 && anio >= 2024;
  });
}
