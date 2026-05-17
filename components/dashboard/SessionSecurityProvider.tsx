"use client";

/**
 * SessionSecurityProvider — wrapper que ata los 3 mecanismos de seguridad
 * de sesión:
 *
 *   1. useIdleTimeout: detección de inactividad → modal de warning →
 *      logout automático si no hay actividad.
 *   2. useSessionPolling: polling silencioso cada 30 min + visibilitychange
 *      para detectar si el admin invalidó la sesión remotamente.
 *   3. IdleWarningModal: UI del countdown de 60s.
 *
 * Se monta UNA vez en el dashboard layout (DashboardClient) y recibe la
 * configuración del usuario actual:
 *   - sessionIdleTimeoutMinutes: del setting global app_settings
 *   - sessionTimeoutExempt: del flag del usuario en users_permissions
 *
 * Si el usuario está exento O el setting global es null, el idle timeout
 * NO aplica (solo corre el polling para detectar logout admin).
 */

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useIdleTimeout } from "@/lib/hooks/useIdleTimeout";
import { useSessionPolling } from "@/lib/hooks/useSessionPolling";
import { IdleWarningModal } from "@/components/dashboard/IdleWarningModal";

interface Props {
  /** Minutos de inactividad antes del auto-logout. null = sin timeout. */
  sessionIdleTimeoutMinutes: number | null;
  /** Si true, el usuario actual está exento del timeout (no aplica). */
  sessionTimeoutExempt: boolean;
}

export function SessionSecurityProvider({
  sessionIdleTimeoutMinutes,
  sessionTimeoutExempt,
}: Props) {
  const router = useRouter();
  const [warningOpen, setWarningOpen] = useState(false);

  // El idle timeout aplica solo si hay setting global Y el usuario NO es exento.
  const idleTimeoutActive =
    sessionIdleTimeoutMinutes != null && !sessionTimeoutExempt;
  const effectiveMinutes = idleTimeoutActive ? sessionIdleTimeoutMinutes : null;

  // Logout local (idle): cerrar sesión vía POST + redirect con reason=idle.
  const doIdleLogout = useCallback(async () => {
    setWarningOpen(false);
    try {
      await fetch("/api/auth/signout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignore — vamos a redirigir igualmente
    }
    router.push("/login?reason=idle");
    router.refresh();
  }, [router]);

  // Logout remoto (admin invalidó): redirect con reason=admin.
  const doRemoteLogout = useCallback(async () => {
    setWarningOpen(false);
    try {
      await fetch("/api/auth/signout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignore
    }
    router.push("/login?reason=admin");
    router.refresh();
  }, [router]);

  // Idle timeout hook — listeners de actividad + timer
  useIdleTimeout({
    timeoutMinutes: effectiveMinutes,
    warningSeconds: 60,
    onWarning: () => setWarningOpen(true),
    onWarningCleared: () => setWarningOpen(false),
    onTimeout: doIdleLogout,
  });

  // Session polling — siempre activo (también para usuarios exentos del
  // idle timeout, porque el admin puede cerrarles sesión manualmente)
  useSessionPolling({
    enabled: true,
    onInvalidated: doRemoteLogout,
  });

  return (
    <IdleWarningModal
      open={warningOpen}
      initialSeconds={60}
      onContinue={() => setWarningOpen(false)}
      onTimeout={doIdleLogout}
    />
  );
}
