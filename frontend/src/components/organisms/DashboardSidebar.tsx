"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { BarChart3, Bot, LayoutGrid, Network } from "lucide-react";

import { cn } from "@/lib/utils";
import { getApiBaseUrl } from "@/lib/api-base";

export function DashboardSidebar() {
  const pathname = usePathname();
  const [systemStatus, setSystemStatus] = useState<
    "unknown" | "operational" | "degraded"
  >("unknown");
  const [statusLabel, setStatusLabel] = useState("System status unavailable");

  useEffect(() => {
    let isMounted = true;
    const apiBase = getApiBaseUrl();
    const checkHealth = async () => {
      try {
        const response = await fetch(`${apiBase}/healthz`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Health check failed");
        }
        const data = (await response.json()) as { ok?: boolean };
        if (!isMounted) return;
        if (data?.ok) {
          setSystemStatus("operational");
          setStatusLabel("All systems operational");
        } else {
          setSystemStatus("degraded");
          setStatusLabel("System degraded");
        }
      } catch {
        if (!isMounted) return;
        setSystemStatus("degraded");
        setStatusLabel("System degraded");
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <aside className="flex h-full w-64 flex-col border-r border-slate-200 bg-white">
      <div className="flex-1 px-3 py-4">
        <p className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Navigation
        </p>
        <nav className="mt-3 space-y-1 text-sm">
          <Link
            href="/dashboard"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-700 transition",
              pathname === "/dashboard"
                ? "bg-blue-100 text-blue-800 font-medium"
                : "hover:bg-slate-100"
            )}
          >
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </Link>
          <Link
            href="/gateways"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-700 transition",
              pathname.startsWith("/gateways")
                ? "bg-blue-100 text-blue-800 font-medium"
                : "hover:bg-slate-100"
            )}
          >
            <Network className="h-4 w-4" />
            Gateways
          </Link>
          <Link
            href="/boards"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-700 transition",
              pathname.startsWith("/boards")
                ? "bg-blue-100 text-blue-800 font-medium"
                : "hover:bg-slate-100"
            )}
          >
            <LayoutGrid className="h-4 w-4" />
            Boards
          </Link>
          <Link
            href="/agents"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-700 transition",
              pathname.startsWith("/agents")
                ? "bg-blue-100 text-blue-800 font-medium"
                : "hover:bg-slate-100"
            )}
          >
            <Bot className="h-4 w-4" />
            Agents
          </Link>
        </nav>
      </div>
      <div className="border-t border-slate-200 p-4">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              systemStatus === "operational" && "bg-emerald-500",
              systemStatus === "degraded" && "bg-rose-500",
              systemStatus === "unknown" && "bg-slate-300"
            )}
          />
          {statusLabel}
        </div>
      </div>
    </aside>
  );
}
