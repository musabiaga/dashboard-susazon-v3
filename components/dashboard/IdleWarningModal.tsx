"use client";

/**
 * IdleWarningModal — modal con countdown que aparece cuando faltan N
 * segundos para el auto-logout por inactividad.
 *
 * Cuando aparece, el usuario tiene 2 opciones:
 *   1. Click en "Seguir conectado" → resetea el timer (vía onContinue)
 *   2. No hacer nada → countdown llega a 0 → logout automático
 *
 * Cualquier mousemove/click/keydown en la página fuera del modal también
 * resetea el timer (lo maneja useIdleTimeout). El modal solo da feedback
 * visual de "estás a punto de expirar".
 *
 * Diseño: backdrop oscuro, modal centrado, countdown grande, botón único.
 * No tiene "X" para cerrar — la única forma de mantenerse activo es el
 * botón "Seguir conectado" (asegura que el usuario consciente).
 */

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

interface Props {
  /** Si false, el modal no se renderiza. */
  open: boolean;
  /** Segundos iniciales del countdown. Default 60. */
  initialSeconds?: number;
  /** Callback cuando usuario presiona "Seguir conectado". El padre debe
   *  desmontar el modal (reset timer). */
  onContinue: () => void;
  /** Callback cuando el countdown llega a 0 sin acción. El padre maneja
   *  el logout. */
  onTimeout: () => void;
}

export function IdleWarningModal({
  open,
  initialSeconds = 60,
  onContinue,
  onTimeout,
}: Props) {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);

  // Reset el countdown cuando el modal se abre
  useEffect(() => {
    if (!open) return;
    setSecondsLeft(initialSeconds);
  }, [open, initialSeconds]);

  // Countdown que decrementa cada segundo
  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [open]);

  // Cuando llega a 0, dispara timeout
  useEffect(() => {
    if (!open) return;
    if (secondsLeft === 0) {
      onTimeout();
    }
  }, [open, secondsLeft, onTimeout]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="idle-warning-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{
        background: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        className="w-full max-w-md rounded-[var(--radius-lg)] border p-6 shadow-2xl"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border-strong)",
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style={{
              background: "var(--warning-soft)",
              color: "var(--warning)",
            }}
          >
            <Clock size={20} />
          </div>
          <div className="flex-1">
            <h2
              id="idle-warning-title"
              className="text-base font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              ¿Sigues ahí?
            </h2>
            <p
              className="mt-1 text-sm leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              Por inactividad, tu sesión cerrará automáticamente en:
            </p>
          </div>
        </div>

        <div
          className="my-5 text-center text-5xl font-bold tabular-nums"
          style={{
            color:
              secondsLeft <= 10 ? "var(--danger)" : "var(--text-primary)",
            transition: "color 0.2s ease",
          }}
        >
          {secondsLeft}
          <span
            className="ml-1 text-base font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            s
          </span>
        </div>

        <button
          type="button"
          onClick={onContinue}
          autoFocus
          className="w-full rounded-[var(--radius)] px-4 py-2.5 text-sm font-semibold text-white transition-colors"
          style={{
            background: "var(--accent)",
          }}
        >
          Seguir conectado
        </button>

        <p
          className="mt-3 text-center text-[11px]"
          style={{ color: "var(--text-muted)" }}
        >
          Cualquier click, scroll o tecla también reinicia el contador.
        </p>
      </div>
    </div>
  );
}
