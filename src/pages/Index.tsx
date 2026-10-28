/**
 * Vector Intelligence Lab — dashboard shell.
 * Wires every view to real OpenServerless actions backed by Milvus.
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { SearchResponse } from "@/lib/types";
import { Sidebar, type ViewId } from "@/components/dashboard/sidebar";
import { Header } from "@/components/dashboard/header";
import { SearchPlayground } from "@/components/dashboard/search-playground";
import { VectorSpaceView } from "@/components/dashboard/vector-space-view";
import { DocumentsManager } from "@/components/dashboard/documents-manager";
import { SimilarityCompare } from "@/components/dashboard/similarity-compare";
import { StatsPanel } from "@/components/dashboard/stats-panel";

export default function Index() {
  const [view, setView] = React.useState<ViewId>("playground");
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const [searchResult, setSearchResult] = React.useState<SearchResponse | null>(null);
  const [selectedDocId, setSelectedDocId] = React.useState<string | null>(null);
  const [comparePreselect, setComparePreselect] = React.useState<string | null>(null);

  const statsQuery = useQuery({
    queryKey: ["stats"],
    queryFn: api.fetchStats,
    refetchInterval: 30_000,
    retry: 1,
  });

  const documentsQuery = useQuery({
    queryKey: ["documents"],
    queryFn: api.fetchDocuments,
  });

  const vectorSpaceQuery = useQuery({
    queryKey: ["vector-space"],
    queryFn: api.fetchVectorSpace,
  });

  const stats = statsQuery.data;
  const connected =
    statsQuery.isLoading
      ? null
      : stats?.ok && stats?.load_state === "Loaded";

  const handleSearch = (result: SearchResponse) => {
    setSearchResult(result);
  };

  const handleLocate = (docId: string) => {
    setSelectedDocId(docId);
    setView("space");
  };

  const handleCompare = (docId: string) => {
    setComparePreselect(docId);
    setView("compare");
  };

  return (
    <div className="min-h-screen">
      {/* ambient scene */}
      <div className="vx-scene" aria-hidden />

      <Sidebar
        view={view}
        onView={setView}
        rowCount={stats?.row_count ?? null}
        dim={stats?.dim ?? null}
        collection={stats?.collection ?? "vector_explorer_documents"}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div className="lg:pl-[248px]">
        <Header
          connected={connected}
          loadState={stats?.load_state}
          latencyMs={stats?.latency?.milvus_search_ms}
          rowCount={stats?.row_count ?? null}
          onOpenMobileNav={() => setMobileNavOpen(true)}
        />

        <main className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8">
          {view === "playground" && (
            <SearchPlayground
              searchResult={searchResult}
              onSearch={handleSearch}
              onCompare={handleCompare}
              onSelect={handleLocate}
            />
          )}

          {view === "space" && (
            <VectorSpaceView
              vectorSpaceQuery={vectorSpaceQuery}
              searchResult={searchResult}
              selectedId={selectedDocId}
              onSelect={setSelectedDocId}
              onCompare={handleCompare}
            />
          )}

          {view === "collection" && (
            <DocumentsManager
              documentsQuery={documentsQuery}
              onCompare={handleCompare}
              onLocate={handleLocate}
              selectedId={selectedDocId}
            />
          )}

          {view === "compare" && (
            <SimilarityCompare
              documents={documentsQuery.data?.documents ?? []}
              preselectId={comparePreselect}
              clearPreselect={() => setComparePreselect(null)}
            />
          )}

          {view === "stats" && <StatsPanel statsQuery={statsQuery} />}

          <footer className="mt-12 border-t border-white/6 pb-8 pt-6 text-center">
            <p className="tech text-[10px] uppercase tracking-[0.24em] text-slate-600">
              React → Nuvolaris OpenServerless Python Actions → Milvus Vector Database
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}