"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MapPin, Users, FileClock, Settings } from "lucide-react";

const TABS = [
  { href: "/admin/territorios", label: "Territorios", icon: MapPin },
  { href: "/admin/usuarios", label: "Usuarios", icon: Users },
  { href: "/admin/audit", label: "Audit Log", icon: FileClock },
  { href: "/admin/configuracion", label: "Configuración", icon: Settings },
] as const;

export function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav
      className="flex items-center gap-1 border-b"
      style={{ borderColor: "var(--border)" }}
    >
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const active = pathname?.startsWith(tab.href) ?? false;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors"
            style={{
              borderColor: active ? "var(--accent)" : "transparent",
              color: active ? "var(--accent)" : "var(--text-muted)",
            }}
          >
            <Icon size={14} />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
