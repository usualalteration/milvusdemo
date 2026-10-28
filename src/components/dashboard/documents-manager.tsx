/** Document Collection Manager — searchable, filterable table + add/delete. */

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Layers,
  SearchX,
  GitCompareArrows,
  Database,
  Hash,
  Cpu,
} from "lucide-react";
import { api } from "@/lib/api";
import type { DocumentRecord, DocumentsResponse } from "@/lib/types";
import { KNOWN_CATEGORIES, formatNumber } from "@/lib/theme";
import {
  GlassCard,
  CategoryBadge,
  EmbeddingStrip,
  EmptyState,
  ErrorPanel,
  SkeletonBlock,
  StatTile,
} from "./shared";
import { cn } from "@/lib/utils";

export function DocumentsManager({
  documentsQuery,
  onCompare,
  onLocate,
  selectedId,
}: {
  documentsQuery: {
    data?: DocumentsResponse;
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
  };
  onCompare: (docId: string) => void;
  onLocate: (docId: string) => void;
  selectedId?: string | null;
}) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [addOpen, setAddOpen] = React.useState(false);

  const addMutation = useMutation({
    mutationFn: api.addDocument,
    onSuccess: (data) => {
      toast.success("Document indexed", {
        description: `“${data.document.title}” embedded into ${data.document.dim}d and stored in Milvus.`,
      });
      setAddOpen(false);
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["vector-space"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (error: Error) =>
      toast.error("Could not add document", { description: error.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteDocument,
    onSuccess: (data) => {
      toast.success("Document deleted", {
        description: `“${data.title}” removed from the vector index.`,
      });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["vector-space"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (error: Error) =>
      toast.error("Could not delete document", { description: error.message }),
  });

  const documents = documentsQuery.data?.documents ?? [];
  const categories = React.useMemo(() => {
    const set = new Set<string>();
    documents.forEach((doc) => set.add(doc.category));
    return Array.from(set).sort();
  }, [documents]);

  const filtered = React.useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return documents.filter((doc) => {
      if (categoryFilter !== "all" && doc.category !== categoryFilter) return false;
      if (!needle) return true;
      return (
        doc.title.toLowerCase().includes(needle) ||
        doc.content.toLowerCase().includes(needle) ||
        doc.category.toLowerCase().includes(needle)
      );
    });
  }, [documents, filter, categoryFilter]);

  return (
    <div className="space-y-6">
      {/* ---- overview tiles ---- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Collection"
          value={documentsQuery.data?.collection ?? "…"}
          hint="Milvus collection name"
          icon={Database}
        />
        <StatTile
          label="Indexed docs"
          value={formatNumber(documentsQuery.data?.total)}
          hint="vectors stored"
          icon={Layers}
          accent="violet"
        />
        <StatTile
          label="Dimensions"
          value={documentsQuery.data?.dim ?? "…"}
          hint="float values per vector"
          icon={Hash}
          accent="emerald"
        />
        <StatTile
          label="Embedding model"
          value={documentsQuery.data?.embedding_model ?? "…"}
          hint="same model for docs & queries"
          icon={Cpu}
          accent="amber"
          className="text-sm"
        />
      </div>

      {/* ---- browser ---- */}
      <GlassCard className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold text-slate-100">
              Indexed documents
            </h3>
            <p className="text-[12px] text-slate-500">
              {formatNumber(filtered.length)} of {formatNumber(documents.length)} shown
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 px-4 py-2 text-sm font-semibold text-[#05070d] shadow-[0_0_20px_rgba(0,217,255,0.3)] transition-all hover:brightness-110"
          >
            <Plus className="h-4 w-4" /> Add document
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <div className="relative min-w-[240px] flex-1">
            <input
              id="doc-filter"
              name="doc-filter"
              type="text"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Filter by title, content, category…"
              className="neon-input h-10 w-full rounded-xl pl-4 pr-4 text-sm"
              aria-label="Filter documents"
            />
          </div>
          <select
            id="category-filter"
            name="category-filter"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="neon-input h-10 rounded-xl px-3 text-sm"
            aria-label="Filter by category"
          >
            <option value="all">All categories</option>
            {(categories.length ? categories : KNOWN_CATEGORIES).map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>

        {documentsQuery.isLoading && (
          <div className="mt-4 space-y-2" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <SkeletonBlock className="h-12 w-12 rounded-xl" />
                <SkeletonBlock className="h-3 flex-1" />
                <SkeletonBlock className="h-3 w-20" />
              </div>
            ))}
          </div>
        )}
        {documentsQuery.isError && (
          <div className="mt-4">
            <ErrorPanel message={(documentsQuery.error as Error)?.message ?? "Unknown error"} />
          </div>
        )}

        {!documentsQuery.isLoading && !documentsQuery.isError && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-separate border-spacing-y-1.5 text-left">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                  <th scope="col" className="px-3 pb-1 font-medium">Document</th>
                  <th scope="col" className="px-3 pb-1 font-medium">Category</th>
                  <th scope="col" className="px-3 pb-1 font-medium">Embedding slice</th>
                  <th scope="col" className="px-3 pb-1 font-medium">Concepts</th>
                  <th scope="col" className="px-3 pb-1 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((doc, index) => (
                  <DocumentRow
                    key={doc.doc_id}
                    doc={doc}
                    index={index}
                    selected={selectedId === doc.doc_id}
                    onDelete={() => deleteMutation.mutate(doc.doc_id)}
                    onCompare={() => onCompare(doc.doc_id)}
                    onLocate={() => onLocate(doc.doc_id)}
                  />
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <EmptyState
                icon={SearchX}
                title="No documents match"
                description="Try clearing the text filter or selecting a different category."
                action={
                  <button
                    type="button"
                    onClick={() => {
                      setFilter("");
                      setCategoryFilter("all");
                    }}
                    className="rounded-xl border border-white/15 px-4 py-2 text-xs text-slate-200 transition-colors hover:border-cyan-400/40 hover:text-cyan-200"
                  >
                    Reset filters
                  </button>
                }
              />
            )}
          </div>
        )}
      </GlassCard>

      {/* ---- add document panel ---- */}
      {addOpen && (
        <GlassCard edgeGlow className="vx-rise p-5 sm:p-6">
          <h3 className="font-display text-lg font-semibold text-slate-100">
            Add a document to the vector index
          </h3>
          <p className="mt-1 text-[12px] text-slate-500">
            The backend embeds your text with the same 512-dimensional model, then inserts
            it into the Milvus collection — instantly searchable.
          </p>
          <form
            className="mt-4 grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              addMutation.mutate({
                title: String(form.get("title") ?? "").trim(),
                category: String(form.get("category") ?? "").trim(),
                content: String(form.get("content") ?? "").trim(),
              });
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="new-doc-title" className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
                  Title
                </label>
                <input
                  id="new-doc-title"
                  name="title"
                  type="text"
                  required
                  maxLength={200}
                  className="neon-input h-10 w-full rounded-xl px-3 text-sm"
                  placeholder="e.g. Quantum Cryptography"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="new-doc-category" className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
                  Category
                </label>
                <input
                  id="new-doc-category"
                  name="category"
                  type="text"
                  required
                  list="known-categories"
                  maxLength={40}
                  defaultValue="Technology"
                  className="neon-input h-10 w-full rounded-xl px-3 text-sm"
                  placeholder="Technology"
                />
                <datalist id="known-categories">
                  {KNOWN_CATEGORIES.map((category) => (
                    <option key={category} value={category} />
                  ))}
                </datalist>
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="new-doc-content" className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
                Content
              </label>
              <textarea
                id="new-doc-content"
                name="content"
                required
                maxLength={4000}
                rows={4}
                className="neon-input w-full rounded-xl px-3 py-2.5 text-sm"
                placeholder="Two or three sentences describing the document…"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-300 transition-colors hover:border-white/30"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addMutation.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 px-5 py-2 text-sm font-semibold text-[#05070d] shadow-[0_0_20px_rgba(0,217,255,0.3)] transition-all hover:brightness-110 disabled:opacity-50"
              >
                {addMutation.isPending ? "Embedding…" : "Embed & index"}
              </button>
            </div>
          </form>
        </GlassCard>
      )}
    </div>
  );
}

function DocumentRow({
  doc,
  index,
  selected,
  onDelete,
  onCompare,
  onLocate,
}: {
  doc: DocumentRecord;
  index: number;
  selected: boolean;
  onDelete: () => void;
  onCompare: () => void;
  onLocate: () => void;
}) {
  const [confirming, setConfirming] = React.useState(false);
  return (
    <tr
      className={cn(
        "vx-fade group text-[13px] transition-colors",
        selected
          ? "bg-cyan-400/10 ring-1 ring-inset ring-cyan-400/30"
          : "bg-white/[0.03] hover:bg-white/[0.055]",
      )}
      style={{ animationDelay: `${Math.min(index, 12) * 45}ms` }}
    >
      <td className="max-w-[280px] rounded-l-xl px-3 py-2.5">
        <div className="truncate font-medium text-slate-100">{doc.title}</div>
        <div className="truncate text-[11px] text-slate-500">{doc.content}</div>
      </td>
      <td className="px-3 py-2.5">
        <CategoryBadge category={doc.category} />
      </td>
      <td className="px-3 py-2.5">
        <EmbeddingStrip values={doc.embedding_sample ?? []} dim={doc.dim} cellCount={10} />
      </td>
      <td className="px-3 py-2.5">
        <span className="tech text-[11px] text-slate-400">
          {doc.concepts.length} concepts
        </span>
      </td>
      <td className="rounded-r-xl px-3 py-2.5 text-right">
        <div className="flex justify-end gap-1 opacity-70 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={onLocate}
            title="Locate in vector space"
            className="rounded-lg border border-white/10 p-1.5 text-slate-400 transition-colors hover:border-violet-400/40 hover:text-violet-300"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onCompare}
            title="Compare with another document"
            className="rounded-lg border border-white/10 p-1.5 text-slate-400 transition-colors hover:border-cyan-400/40 hover:text-cyan-300"
          >
            <GitCompareArrows className="h-3.5 w-3.5" />
          </button>
          {confirming ? (
            <span className="flex items-center gap-1">
              <button
                type="button"
                onClick={onDelete}
                className="rounded-lg border border-rose-400/40 bg-rose-500/20 px-2 py-1 text-[10px] font-semibold text-rose-200"
              >
                delete
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-lg border border-white/15 px-2 py-1 text-[10px] text-slate-300"
              >
                no
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              title="Delete document"
              className="rounded-lg border border-white/10 p-1.5 text-slate-400 transition-colors hover:border-rose-400/40 hover:text-rose-300"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}