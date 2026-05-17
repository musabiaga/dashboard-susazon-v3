"use client";

/**
 * lib/hooks/useIdleTimeout.ts — auto-logout por inactividad.
 *
 * 100% cliente-side. NO genera requests al server. Detecta actividad del
 * usuario (mousemove / mousedown / keydown / scroll / touchstart) y resetea
 * un timer interno cada vez que hay actividad.
 *
 * Cuando el usuario lleva `(timeoutMinutes − 1)` minutos sin actividad,
 * dispara `onWarning()` (mostrar el modal con countdown 60s). Si dentro de
 * esos 60s el usuario interactúa, el timer se resetea y `onWarning(false)`
 * oculta el modal. Si no interactúa, al cumplirse `timeoutMinutes` dispara
 * `onTimeout()` y el componente padre maneja el logout.
 *
 * Configurable:
 *   - timeoutMinutes: null = hook deshabilitado (sesión indefinida).
 *     Cualquier número > 0 = activa el timer.
 *   - warningSeconds: cuántos segundos antes del logout disparar el warning.
 *     Default 60.
 *
 * El hook respeta `document.hidden` (no acumula tiempo cuando la tab está
 * en background si pageVisibilityResetsOnReturn=false). Por default seguimos
 * contando inactividad aunque cambies de tab — eso es lo que el usuario
 * espera (estar en otra app NO te mantiene "activo" en el dashboard).
 */

import { useEffect, useRef, useCallback } from "react";

export interface UseIdleTimeoutOptions {
  /** Minutos de inactividad antes del logout. null = hook deshabilitado. */
  timeoutMinutes: number | null;
  /** Segundos antes del logout para mostrar el warning. Default 60. */
  warningSeconds?: number;
  /** Callback cuando faltan warningSeconds para el logout. El componente
   *  padre debe mostrar el modal de countdown. */
  onWarning: () => void;
  /** Callback cuando hay actividad y el warning debe ocultarse. */
  onWarningCleared: () => void;
  /** Callback cuando se cumple el timeout total — el padre debe ejecutar
   *  el logout (signOut + redirect a /login?reason=idle). */
  onTimeout: () => void;
}

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "wheel",
] as const;

export function useIdleTimeout({
  timeoutMinutes,
  warningSeconds = 60,
  onWarning,
  onWarningCleared,
  onTimeout,
}: UseIdleTimeoutOptions) {
  // Mantenemos refs para los callbacks para no tener que re-suscribir
  // event listeners cuando los callbacks cambien (lo cual sería frecuente).
  const onWarningRef = useRef(onWarning);
  const onWarningClearedRef = useRef(onWarningCleared);
  const onTimeoutRef = useRef(onTimeout);
  useEffect(() => {
    onWarningRef.current = onWarning;
    onWarningClearedRef.current = onWarningCleared;
    onTimeoutRef.current = onTimeout;
  }, [onWarning, onWarningCleared, onTimeout]);

  // Estado interno: ¿el warning está activo? Lo guardamos en ref para
  // que los handlers de actividad sepan si deben llamar a onWarningCleared.
  const warningActiveRef = useRef(false);

  const warnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (warnTimerRef.current) {
      clearTimeout(warnTimerRef.current);
      warnTimerRef.current = null;
    }
    if (finalTimerRef.current) {
      clearTimeout(finalTimerRef.current);
      finalTimerRef.current = null;
    }
  }, []);

  const resetTimer = useCallback(() => {
    if (timeoutMinutes == null || timeoutMinutes <= 0) return;
    clearTimers();
    if (warningActiveRef.current) {
      warningActiveRef.current = false;
      onWarningClearedRef.current();
    }
    const totalMs = timeoutMinutes * 60 * 1000;
    const warnMs = Math.max(0, totalMs - warningSeconds * 1000);
    warnTimerRef.current = setTimeout(() => {
      warningActiveRef.current = true;
      onWarningRef.current();
    }, warnMs);
    finalTimerRef.current = setTimeout(() => {
      onTimeoutRef.current();
    }, totalMs);
  }, [timeoutMinutes, warningSeconds, clearTimers]);

  useEffect(() => {
    if (timeoutMinutes == null || timeoutMinutes <= 0) {
      clearTimers();
      return;
    }
    resetTimer();

    // Listeners pasivos para no impactar performance del scroll/touch.
    const handler = () => resetTimer();
    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, handler, { passive: true });
    }
    return () => {
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, handler);
      }
      clearTimers();
    };
  }, [timeoutMinutes, resetTimer, clearTimers]);
}
