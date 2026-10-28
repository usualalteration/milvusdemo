/** Milvus Statistics — compact technical dashboard with real metadata. */

import * as React from "react";
import {
  Database,
  Hash,
  Ruler,
  Gauge,
  Layers3,
  Rocket,
  Boxes,
  Timer,
  Activity,
  RefreshCw,
  CircleCheck,
  CircleAlert,
} from "lucide-react";
import type { StatsResponse } from "@/lib/types";
import { formatNumber } from "@/lib/theme";
import { GlassCard, StatTile, ErrorPanel, SkeletonBlock, CategoryBadge } from "./shared";
import { categoryStyle } from "@/lib/theme";

export function StatsPanel({
  statsQuery,
}: {
  statsQuery: {
    data?: StatsResponse;
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => void;
    isFetching: boolean;
  };
}) {
  const stats = statsQuery.data;

  if (statsQuery.isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="glass rounded-xl p-4">
            <SkeletonBlock className="h-3 w-24" />
            <SkeletonBlock className="mt-3 h-6 w-32" />
            <SkeletonBlock className="mt-2 h-2.5 w-40" />
          </div>
        ))}
      </div>
    );
  }

  if (statsQuery.isError) {
    return <ErrorPanel message={(statsQuery.error as Error)?.message ?? "Milvus is unreachable"} />;
  }

  if (!stats) return null;

  const searchProbeOk = stats.latency?.search_probe === "ok";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="max-w-xl text-[13px] leading-relaxed text-slate-400">
          Live metadata read from Milvus on every request. Latencies are measured per
          call — the ANN search probe runs a real vector query against the index.
        </p>
        <button
          type="button"
          onClick={() => statsQuery.refetch()}
          disabled={statsQuery.isFetching}
          className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs text-slate-300 transition-colors hover:border-cyan-400/40 hover:text-cyan-200 disabled:opacity-50"
        >
          <RefreshCw className={statsQuery.isFetching ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
          Refresh
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile
          label="Collection"
          value={stats.collection}
          hint={`consistency: ${stats.consistency_level ?? "—"}`}
          icon={Database}
        />
        <StatTile
          label="Vectors stored"
          value={formatNumber(stats.row_count)}
          hint="documents in the index"
          icon={Boxes}
          accent="violet"
        />
        <StatTile
          label="Embedding dimensions"
          value={formatNumber(stats.dim)}
          hint="FLOAT_VECTOR per document"
          icon={Hash}
          accent="emerald"
        />
        <StatTile
          label="Distance metric"
          value={stats.index?.metric ?? "—"}
          hint="higher similarity = closer vectors"
          icon={Ruler}
          accent="amber"
        />
        <StatTile
          label="Index type"
          value={stats.index?.type ?? "—"}
          hint={
            stats.index?.params && Object.keys(stats.index.params).length > 0
              ? Object.entries(stats.index.params)
                  .map(([k, v]) => `${k}=${v}`)
                  .join(" · ")
              : `field: ${stats.index?.field ?? "—"}`
          }
          icon={Layers3}
        />
        <StatTile
          label="Load status"
          value={
            <span className="inline-flex items-center gap-2">
              {stats.load_state === "Loaded" ? (
                <CircleCheck className="h-4 w-4 text-emerald-400" />
              ) : (
                <CircleAlert className="h-4 w-4 text-amber-400" />
              )}
              {stats.load_state}
            </span>
          }
          hint="collection resident in memory"
          icon={Gauge}
          accent="emerald"
        />
        <StatTile
          label="Search latency"
          value={
            searchProbeOk
              ? `${stats.latency.milvus_search_ms.toFixed(1)} ms`
              : "probe failed"
          }
          hint={`HNSW ef=${stats.search_params?.ef ?? "—"} · measured now`}
          icon={Timer}
        />
        <StatTile
          label="Embedding latency"
          value={
            stats.latency?.embed_ms != null
              ? `${stats.latency.embed_ms.toFixed(2)} ms`
              : "—"
          }
          hint="local in-code model"
          icon={Rocket}
          accent="violet"
        />
        <StatTile
          label="Index state"
          value={stats.index?.state ?? "—"}
          hint={
            stats.index?.indexed_rows != null
              ? `${formatNumber(stats.index.indexed_rows)} rows in index`
              : undefined
          }
          icon={Activity}
          accent="amber"
        />
      </div>

      {/* ---- embedding model card ---- */}
      <GlassCard edgeGlow className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-100">
              Embedding model
            </h3>
            <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-slate-400">
              {stats.embedding_model.description}
            </p>
          </div>
          <span className="tech rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-[11px] text-cyan-300">
            {stats.embedding_model.name}
          </span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="tech text-[10px] uppercase tracking-[0.16em] text-slate-500">provider</div>
            <div className="mt-1 text-[13px] text-slate-200">{stats.embedding_model.provider}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="tech text-[10px] uppercase tracking-[0.16em] text-slate-500">dimensions</div>
            <div className="tech mt-1 text-[13px] text-slate-200">{stats.embedding_model.dim}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="tech text-[10px] uppercase tracking-[0.16em] text-slate-500">schema fields</div>
            <div className="tech mt-1 text-[12px] text-slate-200">
              {stats.fields?.map((f) => (
                <span key={f} className="mr-2 text-slate-400">{f}</span>
              ))}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* ---- categories legend ---- */}
      <GlassCard className="p-5 sm:p-6">
        <h3 className="font-display text-base font-semibold text-slate-100">
          Document categories
        </h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {stats.categories.map((category) => (
            <span
              key={category}
              className="inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-[12px]"
              style={{
                borderColor: categoryStyle(category).border,
                backgroundColor: categoryStyle(category).bg,
                color: categoryStyle(category).text,
              }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor: categoryStyle(category).color,
                  boxShadow: `0 0 8px ${categoryStyle(category).color}`,
                }}
              />
              {category}
            </span>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}