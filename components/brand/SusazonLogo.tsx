"use client";

import Image from "next/image";
import { useTheme } from "@/components/theme/ThemeProvider";
import { cn } from "@/lib/utils";

interface SusazonLogoProps {
  /**
   * Forzar variante: 'on-dark' usa el logo blanco (outline), 'on-light' usa el logo oscuro (relleno).
   * Si se omite, se decide según el theme actual + surface.
   */
  variant?: "on-dark" | "on-light";
  /**
   * Sobre qué superficie se va a renderizar el logo. Distinto de variant:
   *   - "header" (default): superficie del header del dashboard (--bg-header,
   *     oscura en casi todos los themes, clara en warm-neo).
   *   - "page": superficie de página/card (--bg-page, --bg-surface). Claro
   *     en la mayoría, oscuro en liquid-glass.
   *
   * El autoVariant ajusta el color del logo para que contraste.
   */
  surface?: "header" | "page";
  /** Ancho en px del wrapper (alto se calcula automático). */
  width?: number;
  /** Alto en px (default 80). */
  height?: number;
  className?: string;
  priority?: boolean;
}

/** Themes con --bg-header oscuro (logo blanco para contrastar) */
const HEADER_DARK_THEMES = new Set([
  "clean",
  "editorial",
  "supabase-orange",
  "stock-market",
  "liquid-glass",
]);
/** Themes con --bg-page oscuro (logo blanco para contrastar) */
const PAGE_DARK_THEMES = new Set(["liquid-glass"]);

export function SusazonLogo({
  variant,
  surface = "header",
  width = 240,
  height = 120,
  className,
  priority,
}: SusazonLogoProps) {
  const { theme } = useTheme();

  // Si la superficie del contexto es oscura → logo blanco (on-dark).
  // Si es clara → logo oscuro (on-light).
  const darkSet = surface === "header" ? HEADER_DARK_THEMES : PAGE_DARK_THEMES;
  const autoVariant: "on-dark" | "on-light" = darkSet.has(theme)
    ? "on-dark"
    : "on-light";
  const finalVariant = variant ?? autoVariant;

  const src =
    finalVariant === "on-light" ? "/susazon-logo-light.png" : "/susazon-logo.png";

  return (
    <Image
      src={src}
      alt="Susazón Gourmet"
      width={width}
      height={height}
      className={cn("h-auto w-auto", className)}
      priority={priority}
    />
  );
}
