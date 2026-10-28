/** Full-size interactive Vector Space view. */

import * as React from "react";
import { Orbit, Info, MousePointerClick, GitCompareArrows } from "lucide-react";
import type { VectorSpaceResponse, SearchResponse, VectorPoint } from "@/lib/types";
import { GlassCard, CategoryBadge, ConceptChip, EmptyState, ErrorPanel, SkeletonBlock } from "./shared";
import { VectorSpacePlot, type PlotQuery } from "./vector-space-plot";
import { formatNumber } from "@/lib/theme";

export function VectorSpaceView({
  vectorSpaceQuery,
  searchResult,
  selectedId,
  onSelect,
  onCompare,
}: {
  vectorSpaceQuery: {
    data?: VectorSpaceResponse;
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
  };
  searchResult: SearchResponse | null;
  selectedId: string | null;
  onSelect: (docId: string | null) => void;
  onCompare: (docId: string) => void;
}) {
  // When a search is active, use its space (has the query point + neighbors).
  const active = searchResult?.vector_space ?? vectorSpaceQuery.data;
  const points: VectorPoint[] = active?.points ?? [];

  const query: PlotQuery | null =
    searchResult?.vector_space?.query_point && searchResult?.vector_space
      ? {
          x: searchResult.vector_space.query_point[0],
          y: searchResult.vector_space.query_point[1],
          neighbors: searchResult.vector_space.neighbor_ids,
        }
      : null;

  const selected = points.find((p) => p.doc_id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <GlassCard edgeGlow className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-slate-100">
              <Orbit className="h-5 w-5 text-violet-400" /> Interactive vector space
            </h2>
            <p className="mt-1 text-[13px] text-slate-400">
              {formatNumber(points.length)} document embeddings projected with PCA —
              colored by category, sized by neighborhood.
            </p>
          </div>
          {active?.explained_variance?.length === 2 && (
            <div className="tech rounded-xl border border-violet-400/25 bg-violet-500/10 px-3 py-2 text-[11px] text-violet-200">
              PC1 {(active.explained_variance[0] * 100).toFixed(1)}% · PC2{" "}
              {(active.explained_variance[1] * 100).toFixed(1)}% variance
            </div>
          )}
        </div>

        {query && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-cyan-400/25 bg-cyan-400/8 px-3 py-2 text-[12px] text-cyan-200">
            <Info className="h-3.5 w-3.5 shrink-0" />
            Showing the active query vector and its nearest neighbors — run a new
            search from the Playground to update this projection.
          </div>
        )}

        <div className="mt-4">
          {vectorSpaceQuery.isLoading && (
            <div className="space-y-3" aria-busy="true">
              <SkeletonBlock className="h-3 w-48" />
              <SkeletonBlock className="h-[420px] w-full rounded-xl" />
            </div>
          )}
          {vectorSpaceQuery.isError && (
            <ErrorPanel message={(vectorSpaceQuery.error as Error)?.message ?? "Unknown error"} />
          )}
          {!vectorSpaceQuery.isLoading && !vectorSpaceQuery.isError && points.length === 0 && (
            <EmptyState
              icon={Orbit}
              title="No vectors to plot yet"
              description="Add documents in the Collection view — their embeddings will appear here as a 2D PCA projection."
            />
          )}
          {points.length > 0 && (
            <VectorSpacePlot
              points={points}
              query={query}
              explainedVariance={active?.explained_variance}
              selectedId={selectedId}
              onSelect={(point) => onSelect(point.doc_id === selectedId ? null : point.doc_id)}
            />
          )}
        </div>
      </GlassCard>

      {/* selected point details */}
      {selected && (
        <GlassCard className="vx-rise p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-lg font-semibold text-slate-100">
                  {selected.title}
                </h3>
                <CategoryBadge category={selected.category} />
              </div>
              <p className="tech mt-1.5 text-[11px] text-slate-500">
                doc_id {selected.doc_id} · PCA({selected.x.toFixed(3)}, {selected.y.toFixed(3)})
                {selected.is_neighbor && " · nearest neighbor of current query"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onCompare(selected.doc_id)}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-3.5 py-2 text-[12px] font-medium text-cyan-200 transition-all hover:bg-cyan-400/20"
            >
              <GitCompareArrows className="h-3.5 w-3.5" /> Compare this document
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <MousePointerClick className="h-3.5 w-3.5" />
            Click any other point to inspect it.
          </div>
        </GlassCard>
      )}

      <GlassCard className="p-5 sm:p-6">
        <h3 className="font-display text-base font-semibold text-slate-100">
          Reading this projection
        </h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-[12.5px] leading-relaxed text-slate-400">
            <span className="tech text-[11px] uppercase tracking-[0.16em] text-cyan-300/80">PCA compression</span>
            <p className="mt-1.5">
              512 dimensions are compressed to 2 using principal component analysis over the
              stored embeddings — the projection keeps only the biggest directions of variance.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-[12.5px] leading-relaxed text-slate-400">
            <span className="tech text-[11px] uppercase tracking-[0.16em] text-violet-300/80">Clusters = topics</span>
            <p className="mt-1.5">
              Points that share concepts drift together. You can often see the six categories
              as loose clouds — but some overlap, because ideas are related across domains.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-[12.5px] leading-relaxed text-slate-400">
            <span className="tech text-[11px] uppercase tracking-[0.16em] text-emerald-300/80">Honest limitation</span>
            <p className="mt-1.5">
              Distances here are approximate. True similarity lives in 512d; search results
              are always computed by Milvus in the full space, never in this plot.
            </p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}