/** Shared types for the Milvus Vector Explorer API responses. */

export interface DocumentRecord {
  doc_id: string;
  title: string;
  category: string;
  content: string;
  concepts: string[];
  created_at: number;
  dim?: number;
  embedding_sample?: number[];
}

export interface DocumentsResponse {
  ok: boolean;
  collection: string;
  total: number;
  dim: number;
  embedding_model?: string;
  documents: DocumentRecord[];
  error?: string;
}

export interface AddDocumentResponse {
  ok: boolean;
  document: DocumentRecord;
  embed_ms?: number;
  embedding_model?: string;
  error?: string;
}

export interface DeleteDocumentResponse {
  ok: boolean;
  deleted?: string;
  title?: string;
  row_count?: number;
  error?: string;
}

export interface SearchResult {
  rank: number;
  doc_id: string;
  title: string;
  category: string;
  content: string;
  distance: number;
  score: number;
  shared_concepts: string[];
  matched_terms: string[];
  keyword_overlap: number;
}

export interface KeywordResult {
  doc_id: string;
  title: string;
  category: string;
  content: string;
  concepts?: string;
  keyword_score: number;
  matched_terms: string[];
}

export interface VectorPoint {
  doc_id: string;
  title: string;
  category: string;
  x: number;
  y: number;
  is_neighbor?: boolean;
  score?: number | null;
  rank?: number | null;
}

export interface SearchLatency {
  embed_ms: number;
  milvus_search_ms: number;
  fetch_ms: number;
  pca_ms: number;
  total_ms: number;
}

export interface SearchResponse {
  ok: boolean;
  query: string;
  limit: number;
  embedding_model: string;
  dim: number;
  metric: string;
  results: SearchResult[];
  keyword_results: KeywordResult[];
  latency: SearchLatency;
  vector_space: {
    method: string;
    explained_variance: number[];
    points: VectorPoint[];
    query_point: [number, number] | null;
    neighbor_ids: string[];
    note: string;
  };
  error?: string;
}

export interface VectorSpaceResponse {
  ok: boolean;
  collection: string;
  count: number;
  dim: number;
  method: string;
  explained_variance: number[];
  points: VectorPoint[];
  note: string;
  elapsed_ms: number;
  error?: string;
}

export interface SimilarityDoc {
  doc_id: string;
  title: string;
  category: string;
  content: string;
  concepts: string[];
  created_at: number;
}

export interface SimilarityResponse {
  ok: boolean;
  score: number;
  score_percent: number;
  method: string;
  metric_note: string;
  shared_concepts: string[];
  doc_a: SimilarityDoc;
  doc_b: SimilarityDoc;
  dim: number;
  error?: string;
}

export interface StatsResponse {
  ok: boolean;
  collection: string;
  row_count: number | null;
  dim: number | null;
  load_state: string;
  consistency_level?: string;
  collection_id?: number;
  index: {
    name: string;
    field: string;
    type: string;
    metric: string;
    params: Record<string, string | number>;
    state?: string;
    indexed_rows?: number;
  };
  search_params: Record<string, number>;
  fields: string[];
  embedding_model: {
    name: string;
    provider: string;
    dim: number;
    description: string;
  };
  latency: {
    milvus_search_ms: number;
    search_probe: string;
    embed_ms: number | null;
    embed_probe: string;
  };
  categories: string[];
  note: string;
  error?: string;
}