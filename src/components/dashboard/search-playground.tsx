/** Semantic Search Playground — the flagship search experience. */

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Search,
  Sparkles,
  Clock,
  KeyRound,
  Wand2,
  ArrowRight,
  Zap,
} from "lucide-react";
import { api } from "@/lib/api";
import type { SearchResponse, VectorPoint } from "@/lib/types";
import {
  GlassCard,
  CategoryBadge,
  ConceptChip,
  ScoreBar,
  ResultSkeletonList,
  EmptyState,
  ErrorPanel,
  HighlightedText,
} from "./shared";
import { VectorSpacePlot } from "./vector-space-plot";

const EXAMPLES = [
  "how do machines learn from experience",
  "trees talking to each other",
  "why can't light escape a black hole",
  "what makes music emotionally moving",
  "underwater cities built by tiny animals",
  "storing energy from the sun",
];

export function SearchPlayground({
  searchResult,
  onSearch,
  onCompare,
  onSelect,
}: {
  searchResult: SearchResponse | null;
  onSearch: (result: SearchResponse, query: string) => void;
  onCompare: (docId: string) => void;
  onSelect: (docId: string) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [limit, setLimit] = React.useState(5);
  const search = useMutation({
    mutationFn: (q: string) => api.search(q, limit),
    onSuccess: (data) => onSearch(data, query.trim()),
    onError: (error: Error) => toast.error("Search failed", { description: error.message }),
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      toast.error("Type a natural-language query first");
      return;
    }
    search.mutate(trimmed);
  };

  const results = searchResult?.results ?? [];
  const keywordResults = searchResult?.keyword_results ?? [];
  const semanticIds = new Set(results.map((r) => r.doc_id));
  const noKeywordHits = results.filter((r) => r.keyword_overlap === 0);

  const plotPoints: VectorPoint[] = searchResult?.vector_space.points ?? [];
  const plotQuery = searchResult?.vector_space.query_point
    ? {
        x: searchResult.vector_space.query_point[0],
        y: searchResult.vector_space.query_point[1],
        neighbors: searchResult.vector_space.neighbor_ids,
      }
    : null;

  return (
    <div className="space-y-6">
      {/* ---- Search hero ---- */}
      <GlassCard edgeGlow className="vx-rise p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-medium text-cyan-300">
            <Sparkles className="h-3 w-3" /> Semantic search playground
          </span>
          {searchResult && (
            <span className="tech text-[11px] text-slate-500">
              model {searchResult.embedding_model} · {searchResult.dim}d · {searchResult.metric}
            </span>
          )}
        </div>

        <h2 className="mt-4 font-display text-2xl font-semibold text-slate-100 sm:text-[28px]">
          Ask in <span className="gradient-text">natural language</span> — find by meaning
        </h2>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-400">
          Your query is embedded into the same vector space as every document. Milvus then
          finds nearest neighbors by cosine similarity — no keyword matching required.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <div className="group relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-cyan-400" />
            <input
              id="semantic-query"
              name="semantic-query"
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="e.g. how do machines learn from experience"
              className="neon-input h-14 w-full rounded-2xl pl-12 pr-32 text-[15px]"
              autoComplete="off"
              aria-label="Natural language search query"
            />
            <button
              type="submit"
              disabled={search.isPending}
              className="absolute right-2.5 top-1/2 inline-flex h-9 -translate-y-1/2 items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 px-4 text-sm font-semibold text-[#05070d] shadow-[0_0_20px_rgba(0,217,255,0.35)] transition-all hover:brightness-110 disabled:opacity-50"
            >
              {search.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#05070d]/40 border-t-[#05070d]" />
                  Searching
                </span>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" /> Search
                </>
              )}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Try</span>
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setQuery(example)}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-300 transition-all hover:border-cyan-400/40 hover:text-cyan-200"
              >
                {example}
              </button>
            ))}
            <label className="ml-auto flex items-center gap-2 text-[11px] text-slate-400">
              results
              <select
                id="search-limit"
                name="search-limit"
                value={limit}
                onChange={(event) => setLimit(Number(event.target.value))}
                className="tech rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[11px] text-slate-200"
              >
                {[3, 5, 8, 10].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
          </div>
        </form>
      </GlassCard>

      {search.isPending && (
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <ResultSkeletonList count={3} />
          <GlassCard className="p-6">
            <SkeletonPlot />
          </GlassCard>
        </div>
      )}

      {search.isError && <ErrorPanel message={(search.error as Error)?.message ?? "Unknown error"} />}

      {searchResult && !search.isPending && (
        <>
          {/* ---- Results + keyword comparison ---- */}
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <GlassCard className="p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-slate-100">
                  <Zap className="h-4 w-4 text-cyan-400" /> Semantic matches
                </h3>
                {searchResult.latency && (
                  <div className="tech flex items-center gap-3 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {searchResult.latency.total_ms.toFixed(1)}ms total
                    </span>
                    <span className="hidden text-cyan-400/80 sm:inline">
                      milvus {searchResult.latency.milvus_search_ms.toFixed(1)}ms
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-4 space-y-3">
                {results.map((result, index) => (
                  <article
                    key={result.doc_id}
                    className="vx-rise glass glass-hover rounded-2xl p-4"
                    style={{ animationDelay: `${index * 90}ms` }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="tech mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-400/10 text-[13px] font-semibold text-cyan-300">
                          {result.rank}
                        </span>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-medium text-slate-100">{result.title}</h4>
                            <CategoryBadge category={result.category} />
                            {result.keyword_overlap === 0 && (
                              <span className="rounded-full border border-violet-400/35 bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium text-violet-200">
                                found with 0 matching keywords
                              </span>
                            )}
                          </div>
                          <p className="mt-1.5 text-[13px] leading-relaxed text-slate-400">
                            <HighlightedText text={result.content} terms={result.matched_terms} />
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {result.shared_concepts.slice(0, 7).map((concept) => (
                              <ConceptChip key={concept} name={concept} />
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="w-24 shrink-0 text-right">
                        <div className="tech text-lg font-bold text-cyan-300">
                          {result.score.toFixed(1)}%
                        </div>
                        <ScoreBar score={result.score} delayMs={index * 120} className="mt-1.5" />
                        <div className="mt-1 flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onCompare(result.doc_id)}
                            className="inline-flex items-center gap-1 text-[10px] text-slate-400 transition-colors hover:text-cyan-300"
                          >
                            compare <ArrowRight className="h-2.5 w-2.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onSelect(result.doc_id)}
                            className="inline-flex items-center gap-1 text-[10px] text-slate-400 transition-colors hover:text-violet-300"
                          >
                            locate
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </GlassCard>

            {/* keyword comparison column */}
            <GlassCard className="p-5 sm:p-6">
              <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-slate-100">
                <KeyRound className="h-4 w-4 text-amber-400" /> Keyword baseline
              </h3>
              <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
                Classic tf-idf keyword search over the same corpus — spot the differences.
              </p>
              <div className="mt-4 space-y-2.5">
                {keywordResults.length === 0 && (
                  <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-[12px] text-slate-400">
                    No document shares any query keyword — keyword search finds{" "}
                    <span className="text-rose-300">nothing</span>, while semantic search found{" "}
                    <span className="text-cyan-300">{results.length}</span> related documents.
                  </p>
                )}
                {keywordResults.map((result, index) => (
                  <div
                    key={result.doc_id}
                    className="vx-fade rounded-xl border border-white/10 bg-white/[0.04] p-3"
                    style={{ animationDelay: `${index * 70}ms` }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-medium text-slate-200">
                        {result.title}
                      </span>
                      {!semanticIds.has(result.doc_id) && (
                        <span className="rounded border border-white/10 px-1 py-0.5 text-[9px] uppercase tracking-wider text-slate-500">
                          not in semantic top {results.length}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <CategoryBadge category={result.category} dot={false} />
                      <span className="tech text-[10px] text-amber-300/80">
                        score {result.keyword_score.toFixed(2)}
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-slate-500">
                      <HighlightedText text={result.content} terms={result.matched_terms} limit={110} />
                    </p>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>

          {/* ---- Live vector space of this search ---- */}
          <GlassCard className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-slate-100">
                <Sparkles className="h-4 w-4 text-violet-400" /> Query vector & neighbors
              </h3>
              <span className="tech text-[10px] text-slate-500">
                embedding {searchResult.latency.embed_ms.toFixed(2)}ms · pca {searchResult.latency.pca_ms.toFixed(1)}ms
              </span>
            </div>
            <div className="mt-3">
              <VectorSpacePlot
                points={plotPoints}
                query={plotQuery}
                explainedVariance={searchResult.vector_space.explained_variance}
                onSelect={(point) => onSelect(point.doc_id)}
              />
            </div>
          </GlassCard>

          {/* ---- Explainer ---- */}
          <GlassCard className="edge-glow p-5 sm:p-6">
            <h3 className="font-display text-lg font-semibold text-slate-100">
              Why semantic search finds documents without matching keywords
            </h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="tech text-[11px] uppercase tracking-[0.16em] text-cyan-300/80">1 · Embedding</div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-400">
                  Both documents and queries are mapped into the same 512-dimensional vector space
                  by the same embedding model — meaning becomes geometry.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="tech text-[11px] uppercase tracking-[0.16em] text-violet-300/80">2 · Nearest neighbors</div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-400">
                  Milvus indexes vectors with HNSW and returns nearest neighbors under cosine
                  similarity — concepts like <span className="text-violet-200">“machines learn”</span> land
                  close to <span className="text-violet-200">“neural networks / training”</span>.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="tech text-[11px] uppercase tracking-[0.16em] text-emerald-300/80">3 · Beyond keywords</div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-400">
                  Keyword search only matches shared words, so synonyms and paraphrases are
                  invisible. Vector similarity captures intent instead of spelling.
                </p>
              </div>
            </div>
            {noKeywordHits.length > 0 && (
              <div className="mt-4 rounded-xl border border-emerald-400/25 bg-emerald-400/8 p-4 text-[13px] leading-relaxed text-emerald-200/90">
                <span className="font-semibold">Live proof from this search:</span>{" "}
                {noKeywordHits.map((r) => r.title).join(" · ")}{" "}
                {noKeywordHits.length === 1 ? "was" : "were"} returned by vector similarity
                despite sharing <span className="font-semibold">zero</span> query keywords.
              </div>
            )}
          </GlassCard>
        </>
      )}

      {!searchResult && !search.isPending && (
        <GlassCard className="p-4">
          <EmptyState
            icon={Sparkles}
            title="No search yet"
            description="Type a query above — or pick one of the example prompts — to watch the vector database find semantically related documents."
          />
        </GlassCard>
      )}
    </div>
  );
}

function SkeletonPlot() {
  return (
    <div className="space-y-3" aria-busy="true">
      <div className="vx-skeleton h-3 w-40 rounded" />
      <div className="vx-skeleton h-64 w-full rounded-xl" />
      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="vx-skeleton h-4 w-16 rounded-full" />
        ))}
      </div>
    </div>
  );
}