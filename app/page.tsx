import { redirect } from "next/navigation";

export default function RootPage() {
  // TODO Fase 1: si la sesión Supabase existe, redirige a /dashboard. Por ahora siempre /login.
  redirect("/login");
}
