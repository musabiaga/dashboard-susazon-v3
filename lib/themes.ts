export type ThemeId =
  | "clean"
  | "editorial"
  | "warm-neo"
  | "supabase-orange"
  | "stock-market"
  | "liquid-glass";

export interface ThemeMeta {
  id: ThemeId;
  label: string;
  description: string;
  preview: { bg: string; surface: string; accent: string; header: string };
}

export const THEMES: ThemeMeta[] = [
  {
    id: "clean",
    label: "Dashboard Clean",
    description: "Estilo SaaS corporativo (replica V2.2)",
    preview: { bg: "#f8fafc", surface: "#ffffff", accent: "#3b82f6", header: "#1e293b" },
  },
  {
    id: "editorial",
    label: "Susazón Editorial",
    description: "Dark Azure + Warm Paper + Orange · Bebas Neue",
    preview: { bg: "#f5efe5", surface: "#ffffff", accent: "#D97757", header: "#1a2332" },
  },
  {
    id: "warm-neo",
    label: "Warm Neo-Editorial",
    description: "Crema + Coral · estilo Anthropic minimalista",
    preview: { bg: "#F5F0E8", surface: "#FFFFFF", accent: "#D97757", header: "#FFFFFF" },
  },
  {
    id: "supabase-orange",
    label: "Susazón Moderno",
    description: "Dark back-office moderno · Naranja Susazón",
    preview: { bg: "#0a0a0a", surface: "#171717", accent: "#ed6808", header: "#0a0a0a" },
  },
  {
    id: "stock-market",
    label: "Stock Market",
    description: "Trader desk · Azul nocturno + neón cyan/verde",
    preview: { bg: "#0a1124", surface: "#111a36", accent: "#00d9ff", header: "#060a18" },
  },
  {
    id: "liquid-glass",
    label: "Liquid Glass",
    description: "Apple iOS 26 · Aurora naranja + frosted glass",
    preview: { bg: "#0c0a1f", surface: "#ed6808", accent: "#ff8a3b", header: "#06b6d4" },
  },
];

export const DEFAULT_THEME: ThemeId = "clean";
export const THEME_STORAGE_KEY = "dashboard-susazon-theme";
