/** Top header: Vector Intelligence Lab + live Milvus connection indicator. */

import * as React from "react";
import { Menu, CircleCheck, CircleAlert, Loader2, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";

export function Header({
  connected,
  loadState,
  latencyMs,
  rowCount,
  onOpenMobileNav,
}: {
  connected: boolean | null;
  loadState?: string;
  latencyMs?: number | null;
  rowCount?: number | null;
  onOpenMobileNav: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/8 bg-[#080b14]/80 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-4 px-4 sm:px-6">
        <button
          type="button"
          onClick={onOpenMobileNav}
          className="rounded-xl border border-white/10 p-2 text-slate-300 transition-colors hover:border-cyan-400/40 hover:text-cyan-200 lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-lg font-bold tracking-tight text-slate-50 sm:text-xl">
            Vector <span className="gradient-text">Intelligence</span> Lab
          </h1>
          <p className="tech hidden text-[10px] uppercase tracking-[0.22em] text-slate-500 sm:block">
            milvus vector explorer · semantic search lab
          </p>
        </div>

        <div
          className={cn(
            "flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[11px] font-medium",
            connected === null && "border-white/10 bg-white/5 text-slate-400",
            connected === true && "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
            connected === false && "border-rose-400/30 bg-rose-400/10 text-rose-300",
          )}
          role="status"
          aria-live="polite"
        >
          {connected === null ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : connected ? (
            <span className="vx-live-dot inline-flex text-emerald-400">
              <CircleCheck className="h-3.5 w-3.5" />
            </span>
          ) : (
            <CircleAlert className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">
            {connected === null
              ? "connecting…"
              : connected
                ? `Milvus ${loadState ? loadState.toLowerCase() : "connected"}`
                : "Milvus offline"}
          </span>
          <span className="sm:hidden">{connected === null ? "…" : connected ? "live" : "down"}</span>
        </div>

        {latencyMs != null && connected && (
          <div className="hidden items-center gap-1.5 rounded-full border border-cyan-400/25 bg-cyan-400/8 px-3 py-1.5 text-[11px] text-cyan-300 md:flex">
            <Wifi className="h-3 w-3" />
            <span className="tech">{latencyMs.toFixed(1)}ms</span>
          </div>
        )}
      </div>
    </header>
  );
}