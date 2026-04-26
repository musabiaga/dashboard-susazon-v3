"use client";

import Image from "next/image";
import { useTheme } from "@/components/theme/ThemeProvider";
import { cn } from "@/lib/utils";

interface SusazonLogoProps {
  /**
   * Forzar variante: 'on-dark' usa el logo blanco (outline), 'on-light' usa el logo oscuro (relleno).
   * Si se omite, se decide según el theme actual.
   */
  variant?: "on-dark" | "on-light";
  /** Ancho en px del wrapper (alto se calcula automático). */
  width?: number;
  /** Alto en px (default 80). */
  height?: number;
  className?: string;
  priority?: boolean;
}

export function SusazonLogo({
  variant,
  width = 240,
  height = 120,
  className,
  priority,
}: SusazonLogoProps) {
  const { theme } = useTheme();

  // En themes Clean y Editorial el header es oscuro → usamos logo blanco (outline).
  // En theme Warm Neo el header es blanco → usamos logo oscuro (relleno).
  const autoVariant: "on-dark" | "on-light" = theme === "warm-neo" ? "on-light" : "on-dark";
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
