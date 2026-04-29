/**
 * Wrapper server-side de las APIs REST de Susazón y Suve.
 * NUNCA importar desde Client Components — las API keys viven en process.env.
 *
 * Susazón está en SQL Enterprise (rápido). Suve está en SQL Express (lento;
 * timeouts ~90s por mes). Vercel Edge tolera timeouts más largos que el browser
 * del V2.2, así que ambas se llaman directo desde el servidor.
 */

/**
 * Fila tal como viene de la API (algunos tipos no son los esperados).
 */
export interface SusazonApiRow {
  empresa: string; // "SUSAZON" | "SUVE" — viene como string, NO int
  no_cliente: string;
  cliente: string;
  territorio: string;
  vendedor: string;
  sku: string;
  kg: number | string;
  fecha: string; // YYYY-MM-DD
  anio: number | string;
  mes: number | string;
  venta: number | string;
  margen: number | string;
  familia: string | null;
  grupo: string | null;
}

/**
 * Fila normalizada lista para insertar en `sales_rows`.
 */
export interface NormalizedRow {
  empresa: 0 | 1; // 0 = Susazón, 1 = Suve
  no_cliente: string;
  cliente: string | null;
  territorio: string;
  vendedor: string | null;
  sku: string | null;
  kg: number;
  fecha: string;
  anio: number;
  mes: number;
  venta: number;
  margen: number;
  familia: string | null;
  grupo: string | null;
}

export interface MonthFetchResult {
  desde: string;
  hasta: string;
  source: ApiSource;
  rows: NormalizedRow[];
  pagesFetched: number;
  totalPages: number;
  error?: string;
}

export type ApiSource = "susazon" | "suve";

interface ApiConfig {
  url: string;
  apiKey: string;
  empresaCode: 0 | 1;
  timeoutMs: number;
}

const PAGE_SIZE = 50_000;

/**
 * Devuelve la config (url + key + empresa code) para una source dada.
 * Lee de process.env — server-side only.
 */
function getApiConfig(source: ApiSource): ApiConfig {
  // Trim whitespace defensivo — Vercel UI a veces deja un espacio o newline
  // pegado al copy/paste y causa "string did not match expected pattern"
  // al construir el fetch.
  const sanitize = (v: string | undefined) => v?.replace(/\s+/g, "").trim();
  const validateUrl = (envName: string, raw: string | undefined): string => {
    const v = sanitize(raw);
    if (!v) {
      throw new Error(`${envName} no está configurado en process.env`);
    }
    try {
      new URL(v);
    } catch {
      throw new Error(
        `${envName} malformada: "${v.slice(0, 80)}${v.length > 80 ? "..." : ""}". Esperado URL completa con https://`
      );
    }
    return v;
  };

  if (source === "susazon") {
    const url = validateUrl("SUSAZON_API_URL", process.env.SUSAZON_API_URL);
    const apiKey = sanitize(process.env.SUSAZON_API_KEY);
    if (!apiKey) {
      throw new Error("SUSAZON_API_KEY no está configurada en process.env");
    }
    return { url, apiKey, empresaCode: 0, timeoutMs: 120_000 }; // Susazón es SQL Enterprise — margen amplio
  }

  // suve
  const url = validateUrl("SUVE_API_URL", process.env.SUVE_API_URL);
  const apiKey = sanitize(process.env.SUVE_API_KEY);
  if (!apiKey || apiKey.includes("PEGAR_AQUI")) {
    throw new Error(
      "SUVE_API_KEY no configurada en process.env — Suve sigue deshabilitado"
    );
  }
  return { url, apiKey, empresaCode: 1, timeoutMs: 600_000 }; // Suve es SQL Express — hasta 10 min por página
}

/**
 * Convierte la fila cruda de la API a la fila normalizada para insert.
 * - empresa: string ("SUSAZON"|"SUVE") → int (0|1)
 * - kg/anio/mes/venta/margen: a number
 * - cliente/vendedor/sku/familia/grupo: trim + null si vacío
 */
function normalizeRow(raw: SusazonApiRow, fallbackEmpresa: 0 | 1): NormalizedRow {
  const empresaStr = String(raw.empresa ?? "").toUpperCase().trim();
  const empresa: 0 | 1 =
    empresaStr === "SUSAZON" || empresaStr === "0"
      ? 0
      : empresaStr === "SUVE" || empresaStr === "1"
      ? 1
      : fallbackEmpresa;

  const num = (v: unknown): number => {
    const n = typeof v === "number" ? v : parseFloat(String(v ?? "0"));
    return isNaN(n) ? 0 : n;
  };

  const trimNull = (v: unknown): string | null => {
    if (v == null) return null;
    const s = String(v).trim();
    return s === "" ? null : s;
  };

  return {
    empresa,
    no_cliente: String(raw.no_cliente ?? "").trim(),
    cliente: trimNull(raw.cliente),
    territorio: String(raw.territorio ?? "Sin territorio").trim(),
    vendedor: trimNull(raw.vendedor),
    sku: trimNull(raw.sku),
    kg: num(raw.kg),
    fecha: String(raw.fecha ?? ""),
    anio: Math.trunc(num(raw.anio)),
    mes: Math.trunc(num(raw.mes)),
    venta: num(raw.venta),
    margen: num(raw.margen),
    familia: trimNull(raw.familia),
    grupo: trimNull(raw.grupo),
  };
}

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
 * Trae todas las filas de un mes específico de la source dada (paginadas).
 * Tolerante a fallos: si una página falla, devuelve lo acumulado + error.
 */
export async function fetchMonth(
  source: ApiSource,
  year: number,
  month: number
): Promise<MonthFetchResult> {
  const cfg = getApiConfig(source);

  const desde = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const hasta = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const allRows: NormalizedRow[] = [];
  let page = 1;
  let totalPages = 1;
  let lastError: string | undefined;

  while (page <= totalPages) {
    try {
      const res = await fetchWithTimeout(
        cfg.url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-KEY": cfg.apiKey,
          },
          body: JSON.stringify({
            page,
            page_size: PAGE_SIZE,
            desde,
            hasta,
          }),
        },
        cfg.timeoutMs
      );

      if (!res.ok) {
        lastError = `HTTP ${res.status} en página ${page} (${source})`;
        break;
      }

      const rawText = await res.text();
      const cleaned = cleanResponseText(rawText);

      let parsed: { status?: string; total_paginas?: number; data?: SusazonApiRow[] };
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        lastError = `JSON inválido en página ${page} (${source})`;
        break;
      }

      if (parsed.total_paginas) totalPages = parsed.total_paginas;

      const rawRows = Array.isArray(parsed.data) ? parsed.data : [];
      for (const raw of rawRows) {
        allRows.push(normalizeRow(raw, cfg.empresaCode));
      }

      if (rawRows.length < PAGE_SIZE) break; // optimización: no más páginas
      page++;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      break;
    }
  }

  return {
    desde,
    hasta,
    source,
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
export function filterValidRows(rows: NormalizedRow[]): NormalizedRow[] {
  return rows.filter((r) => r.kg > 0 && r.anio >= 2024);
}
