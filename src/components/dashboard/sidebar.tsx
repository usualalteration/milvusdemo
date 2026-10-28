/** Compact sidebar with the Vector Explorer brand and view navigation. */

import * as React from "react";
import {
  Search,
  Orbit,
  LibraryBig,
  Scale,
  Activity,
  Boxes,
  Hash,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/theme";

export type ViewId = "playground" | "space" | "collection" | "compare" | "stats";

const NAV: { id: ViewId; label: string; hint: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "playground", label: "Playground", hint: "semantic search", icon: Search },
  { id: "space", label: "Vector Space", hint: "PCA projection", icon: Orbit },
  { id: "collection", label: "Collection", hint: "documents", icon: LibraryBig },
  { id: "compare", label: "Compare", hint: "similarity", icon: Scale },
  { id: "stats", label: "Statistics", hint: "Milvus", icon: Activity },
];

export function Sidebar({
  view,
  onView,
  rowCount,
  dim,
  collection,
  mobileOpen,
  onCloseMobile,
}: {
  view: ViewId;
  onView: (view: ViewId) => void;
  rowCount: number | null;
  dim: number | null;
  collection: string;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  return (
    <>
      {/* mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
          aria-hidden
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col border-r border-white/8 bg-[#06080f]/95 backdrop-blur-xl transition-transform lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Main navigation"
      >
        {/* brand */}
        <div className="flex items-center gap-3 px-5 pt-6 pb-5">
          <div className="relative">
            <div className="absolute inset-0 rounded-xl bg-cyan-400/30 blur-lg" aria-hidden />
            <svg viewBox="0 0 32 32" className="relative h-10 w-10" aria-hidden>
              <defs>
                <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00d9ff" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
              <rect x="2" y="2" width="28" height="28" rx="9" fill="none" stroke="url(#logo-grad)" strokeWidth="1.6" />
              <circle cx="9" cy="10" r="2.4" fill="#00d9ff" />
              <circle cx="23" cy="8.5" r="2" fill="#8b5cf6" />
              <circle cx="16" cy="16" r="3" fill="url(#logo-grad)" />
              <circle cx="8" cy="23" r="2" fill="#10b981" />
              <circle cx="23.5" cy="23" r="2.4" fill="#f472b6" />
              <path
                d="M9 10L16 16L23 8.5M9 23L16 16L23.5 23"
                stroke="rgba(148,163,184,0.45)"
                strokeWidth="0.9"
                fill="none"
              />
            </svg>
          </div>
          <div>
            <div className="font-display text-[15px] font-bold leading-tight text-slate-100">
              Milvus
              <span className="gradient-text"> Vector</span>
            </div>
            <div className="tech text-[9px] uppercase tracking-[0.28em] text-slate-500">
              Explorer
            </div>
          </div>
        </div>

        {/* nav */}
        <nav className="mt-2 flex-1 space-y-1 px-3" aria-label="Views">
          {NAV.map((item) => {
            const active = view === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onView(item.id);
                  onCloseMobile();
                }}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left transition-all",
                  active
                    ? "border border-cyan-400/25 bg-gradient-to-r from-cyan-400/12 to-violet-500/12 text-slate-100"
                    : "border border-transparent text-slate-400 hover:border-white/10 hover:bg-white/5 hover:text-slate-200",
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r bg-cyan-400 shadow-[0_0_8px_#00d9ff]" />
                )}
                <Icon
                  className={cn(
                    "h-4 w-4 transition-colors",
                    active ? "text-cyan-300" : "text-slate-500 group-hover:text-slate-300",
                  )}
                />
                <span className="flex-1">
                  <span className="block text-[13px] font-medium">{item.label}</span>
                  <span className="block text-[10px] text-slate-600">{item.hint}</span>
                </span>
              </button>
            );
          })}
        </nav>

        {/* footer stats */}
        <div className="space-y-2 px-5 pb-6 pt-4">
          <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
            <div className="tech flex items-center gap-2 text-[10px] text-slate-500">
              <Boxes className="h-3 w-3 text-violet-400" /> {formatNumber(rowCount)} vectors
            </div>
            <div className="tech mt-1 flex items-center gap-2 text-[10px] text-slate-500">
              <Hash className="h-3 w-3 text-cyan-400" /> {dim ?? "—"} dimensions
            </div>
            <div className="mt-2 truncate text-[9px] uppercase tracking-[0.18em] text-slate-600">
              {collection}
            </div>
          </div>
          <p className="tech text-[9px] leading-relaxed text-slate-600">
            React → OpenServerless actions → Milvus
          </p>
        </div>
      </aside>
    </>
  );
}