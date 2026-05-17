"use client";

/**
 * lib/hooks/useSessionPolling.ts — detección de logout remoto vía polling.
 *
 * Dispara GET /api/auth/check periódicamente (default 30 min) + cuando la
 * tab regresa a foreground (visibilitychange). Si el endpoint responde 401,
 * la sesión fue invalidada por admin → dispara onInvalidated() y el padre
 * redirige a /login?reason=admin.
 *
 * Diseño deliberadamente económico: el polling de fondo es el FALLBACK.
 * El mecanismo principal de detección es el middleware (proxy.ts) que
 * valida en cada request real del dashboard. El polling solo cubre el
 * caso "usuario observando el dashboard sin tocar nada por largos
 * periodos".
 *
 * ~5,600 requests/mes para 15 usuarios con polling de 30 min — vs ~21,000
 * con polling de 60 segundos (−74%).
 */

import { useEffect, useRef } from "react";

export interface UseSessionPollingOptions {
  /** Si false, el hook no hace nada (útil para usar conditionally). */
  enabled?: boolean;
  /** Intervalo de polling en milisegundos. Default 30 minutos. */
  intervalMs?: number;
  /** Callback cuando el server responde 401. El padre debe ejecutar el
   *  logout y redirect (typicamente a /login?reason=admin). */
  onInvalidated: () => void;
}

const DEFAULT_INTERVAL_MS = 30 * 60 * 1000; // 30 minutos

export function useSessionPolling({
  enabled = true,
  intervalMs = DEFAULT_INTERVAL_MS,
  onInvalidated,
}: UseSessionPollingOptions) {
  const onInvalidatedRef = useRef(onInvalidated);
  useEffect(() => {
    onInvalidatedRef.current = onInvalidated;
  }, [onInvalidated]);

  // Para no disparar el callback más de una vez (cuando invalida, el
  // padre ya redirige; cualquier check posterior debe no-op).
  const invalidatedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    invalidatedRef.current = false;

    let cancelled = false;

    const check = async () => {
      if (cancelled || invalidatedRef.current) return;
      try {
        const resp = await fetch("/api/auth/check", {
          method: "GET",
          credentials: "include",
          // No-cache para que el browser no devuelva 200 cacheado cuando
          // la sesión ya está invalidada server-side.
          cache: "no-store",
        });
        if (cancelled || invalidatedRef.current) return;
        if (resp.status === 401) {
          invalidatedRef.current = true;
          onInvalidatedRef.current();
        }
      } catch {
        // Error de red: ignorar. No queremos hacer logout falso por
        // un error transitorio. El próximo polling lo detectará si es real.
      }
    };

    // Polling periódico
    const interval = setInterval(check, intervalMs);

    // Check adicional cuando la tab regresa a foreground (usuario cambia
    // de tab y vuelve). Captura el caso "admin cerró sesión mientras yo
    // estaba en otra tab" mucho más rápido que esperar al próximo polling.
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        check();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    // Check al focus de la ventana (cuando vuelves de otra app)
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled, intervalMs]);
}
