export type ThemeId = "clean" | "editorial" | "warm-neo";

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
];

export const DEFAULT_THEME: ThemeId = "clean";
export const THEME_STORAGE_KEY = "dashboard-susazon-theme";
