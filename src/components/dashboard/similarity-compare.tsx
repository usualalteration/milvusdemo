/** Similarity Comparison — pick two documents, see their cosine similarity. */

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Scale, Sparkle, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import type { SimilarityResponse, DocumentRecord } from "@/lib/types";
import { categoryStyle, scoreColor } from "@/lib/theme";
import { GlassCard, CategoryBadge, ConceptChip, EmptyState, ErrorPanel } from "./shared";
import { SimilarityGauge } from "./gauge";

export function SimilarityCompare({
  documents,
  preselectId,
  clearPreselect,
}: {
  documents: DocumentRecord[];
  preselectId?: string | null;
  clearPreselect?: () => void;
}) {
  const [idA, setIdA] = React.useState("");
  const [idB, setIdB] = React.useState("");

  React.useEffect(() => {
    if (preselectId) {
      if (!idA) setIdA(preselectId);
      else if (!idB && idA !== preselectId) setIdB(preselectId);
      clearPreselect?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectId]);

  const compare = useMutation({
    mutationFn: () => api.similarity(idA, idB),
    onSuccess: (data) => {
      if (data.score >= 0.45) {
        toast.success("Strong semantic overlap", {
          description: `${data.doc_a.title} ↔ ${data.doc_b.title}: ${(data.score * 100).toFixed(1)}%`,
        });
      }
    },
    onError: (error: Error) =>
      toast.error("Comparison failed", { description: error.message }),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!idA || !idB) {
      toast.error("Select two documents to compare");
      return;
    }
    if (idA === idB) {
      toast.error("Choose two different documents");
      return;
    }
    compare.mutate();
  };

  const result = compare.data;
  const conceptStats = React.useMemo(() => {
    if (!result) return null;
    const a = result.doc_a.concepts.length || 1;
    const b = result.doc_b.concepts.length || 1;
    const shared = result.shared_concepts.length;
    return [
      { label: result.doc_a.title, value: a, color: categoryStyle(result.doc_a.category).color },
      { label: result.doc_b.title, value: b, color: categoryStyle(result.doc_b.category).color },
      { label: "shared concepts", value: shared, color: "#00d9ff" },
    ];
  }, [result]);
  const maxConcepts = conceptStats ? Math.max(...conceptStats.map((s) => s.value)) : 1;

  return (
    <div className="space-y-6">
      <GlassCard className="p-5 sm:p-6">
        <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-slate-100">
          <Scale className="h-4 w-4 text-violet-400" /> Pick two vectors to compare
        </h3>
        <p className="mt-1 text-[12px] text-slate-500">
          The backend loads both stored embeddings from Milvus and computes the exact cosine
          similarity between them.
        </p>

        <form onSubmit={submit} className="mt-4 grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <div className="space-y-1.5">
            <label htmlFor="doc-a" className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
              Document A
            </label>
            <select
              id="doc-a"
              name="doc-a"
              value={idA}
              onChange={(event) => setIdA(event.target.value)}
              className="neon-input h-10 w-full rounded-xl px-3 text-sm"
            >
              <option value="">— select document —</option>
              {documents.map((doc) => (
                <option key={doc.doc_id} value={doc.doc_id}>
                  {doc.title}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="doc-b" className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
              Document B
            </label>
            <select
              id="doc-b"
              name="doc-b"
              value={idB}
              onChange={(event) => setIdB(event.target.value)}
              className="neon-input h-10 w-full rounded-xl px-3 text-sm"
            >
              <option value="">— select document —</option>
              {documents.map((doc) => (
                <option key={doc.doc_id} value={doc.doc_id}>
                  {doc.title}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={compare.isPending}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 px-5 text-sm font-semibold text-[#05070d] shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all hover:brightness-110 disabled:opacity-50"
          >
            {compare.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkle className="h-4 w-4" />
            )}
            Compare
          </button>
        </form>
      </GlassCard>

      {compare.isError && (
        <ErrorPanel message={(compare.error as Error)?.message ?? "Unknown error"} />
      )}

      {result && (
        <div className="vx-fade space-y-6">
          {/* ---- gauge + docs ---- */}
          <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
            <GlassCard edgeGlow className="flex flex-col items-center justify-center p-6">
              <SimilarityGauge score={result.score_percent} />
              <p className="tech mt-2 text-[11px] text-slate-500">
                cosine = {result.score.toFixed(4)} · {result.dim}d
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-1">
                {result.shared_concepts.slice(0, 8).map((concept) => (
                  <ConceptChip key={concept} name={concept} />
                ))}
                {result.shared_concepts.length === 0 && (
                  <span className="text-[11px] text-slate-500">no shared concepts</span>
                )}
              </div>
            </GlassCard>

            <div className="grid gap-4 sm:grid-cols-2">
              <CompareDocCard side="A" doc={result.doc_a} />
              <CompareDocCard side="B" doc={result.doc_b} />
            </div>
          </div>

          {/* ---- comparison chart + explanation ---- */}
          <div className="grid gap-6 lg:grid-cols-2">
            <GlassCard className="p-5 sm:p-6">
              <h4 className="font-display text-base font-semibold text-slate-100">
                Concept overlap
              </h4>
              <p className="mt-1 text-[11px] text-slate-500">
                Semantic concepts detected by the embedding model in each document.
              </p>
              <div className="mt-4 space-y-3">
                {conceptStats?.map((stat, index) => (
                  <div key={stat.label} className="vx-rise" style={{ animationDelay: `${index * 120}ms` }}>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="truncate text-slate-300">{stat.label}</span>
                      <span className="tech" style={{ color: stat.color }}>{stat.value}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/6">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(stat.value / maxConcepts) * 100}%`,
                          backgroundColor: stat.color,
                          boxShadow: `0 0 10px ${stat.color}`,
                          transition: "width 0.9s cubic-bezier(0.22, 1, 0.36, 1)",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 space-y-2">
                <SpectrumBar score={result.score_percent} />
              </div>
            </GlassCard>

            <GlassCard className="p-5 sm:p-6">
              <h4 className="font-display text-base font-semibold text-slate-100">
                Similarity & vector distance
              </h4>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-400">
                An embedding places each document at a point in 512-dimensional space. Cosine
                similarity measures the <span className="text-cyan-300">angle</span> between
                two vectors: identical direction → 1, unrelated → near 0, opposite → negative.
                Milvus uses this exact metric ({result.method === "cosine" ? "COSINE" : result.method}) to rank
                nearest neighbors during vector search.
              </p>
              <div className="mt-4 space-y-2.5 text-[12px]">
                {[
                  ["100%", "same direction — near-duplicate meaning", "#10b981"],
                  ["~60%", "strongly related topic", scoreColor(60)],
                  ["~30%", "loosely connected", scoreColor(30)],
                  ["~0%", "no semantic relationship", "#f472b6"],
                ].map(([range, desc, color]) => (
                  <div key={String(range)} className="flex items-center gap-3">
                    <span className="tech w-12 shrink-0 text-right" style={{ color }}>
                      {range}
                    </span>
                    <span className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${color}55, transparent)` }} />
                    <span className="text-slate-400">{desc}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-[12px] leading-relaxed text-slate-400">
                This pair scored <span className="tech font-semibold" style={{ color: scoreColor(result.score_percent) }}>
                  {(result.score * 100).toFixed(1)}%
                </span>{" "}
                — {result.score >= 0.45
                  ? "these documents talk about closely related ideas."
                  : result.score >= 0.2
                    ? "these documents share some thematic ground."
                    : "these documents cover different subjects."}
              </p>
            </GlassCard>
          </div>
        </div>
      )}

      {!result && !compare.isPending && !compare.isError && (
        <GlassCard className="p-4">
          <EmptyState
            icon={Scale}
            title="No comparison yet"
            description="Select two documents above to measure their semantic similarity, see shared concepts, and understand how vector distance relates to meaning."
          />
        </GlassCard>
      )}
    </div>
  );
}

function CompareDocCard({ side, doc }: { side: "A" | "B"; doc: SimilarityResponse["doc_a"] }) {
  const style = categoryStyle(doc.category);
  return (
    <div className="glass glass-hover flex flex-col rounded-2xl p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="tech rounded-md px-2 py-0.5 text-[10px] font-bold text-[#05070d]" style={{ backgroundColor: style.color }}>
          {side}
        </span>
        <CategoryBadge category={doc.category} />
      </div>
      <h4 className="mt-2.5 font-display text-base font-semibold text-slate-100">
        {doc.title}
      </h4>
      <p className="mt-2 flex-1 text-[12.5px] leading-relaxed text-slate-400">{doc.content}</p>
      <div className="mt-3 flex flex-wrap gap-1">
        {doc.concepts.slice(0, 10).map((concept) => (
          <span
            key={concept}
            className="tech rounded border px-1.5 py-0.5 text-[9px]"
            style={{ borderColor: style.border, color: style.text, backgroundColor: style.bg }}
          >
            {concept}
          </span>
        ))}
      </div>
    </div>
  );
}

function SpectrumBar({ score }: { score: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-slate-500">
        <span>unrelated</span>
        <span>identical meaning</span>
      </div>
      <div className="relative mt-1.5 h-3 rounded-full bg-gradient-to-r from-rose-500/25 via-violet-500/30 to-emerald-400/40">
        <div
          className="absolute top-1/2 h-5 w-1.5 -translate-y-1/2 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.8)] transition-all duration-1000"
          style={{ left: `calc(${Math.min(100, Math.max(0, score))}% - 3px)` }}
        />
      </div>
      <div className="tech mt-1.5 text-center text-[10px] text-slate-500">
        this pair sits at {score.toFixed(1)}%
      </div>
    </div>
  );
}