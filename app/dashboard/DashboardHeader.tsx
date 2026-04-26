"use client";

import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";

interface DashboardHeaderProps {
  userName: string;
  userRole: string;
}

export function DashboardHeader({ userName, userRole }: DashboardHeaderProps) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return <Header userName={userName} userRole={userRole} onLogout={handleLogout} />;
}
