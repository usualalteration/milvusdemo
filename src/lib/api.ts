/**
 * API client for the Milvus Vector Explorer OpenServerless actions.
 * All calls use relative /api/my URLs. Responses are normalized because the
 * generated wrappers nest module results under {"body": ...}.
 */

const BASE = "/api/my";

async function unwrap<T>(response: Response): Promise<T> {
  const raw = await response.json();
  const data =
    raw && typeof raw === "object" && "body" in raw ? raw.body : raw;
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || `Request failed (${response.status})`);
  }
  return data as T;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  params?: Record<string, string | number>,
): Promise<T> {
  let url = `${BASE}${path}`;
  if (params) {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => search.set(k, String(v)));
    url += `?${search.toString()}`;
  }
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  return unwrap<T>(response);
}

export const api = {
  fetchDocuments: () =>
    request<import("./types").DocumentsResponse>("/v1/documents"),

  addDocument: (payload: { title: string; category: string; content: string }) =>
    request<import("./types").AddDocumentResponse>("/v1/documents", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  deleteDocument: (docId: string) =>
    request<import("./types").DeleteDocumentResponse>(
      `/v1/documents/${encodeURIComponent(docId)}`,
      { method: "DELETE" },
    ),

  search: (query: string, limit = 5) =>
    request<import("./types").SearchResponse>(
      "/v1/search",
      { method: "POST", body: JSON.stringify({ query, limit }) },
    ),

  fetchVectorSpace: () =>
    request<import("./types").VectorSpaceResponse>("/v1/vector-space"),

  similarity: (idA: string, idB: string) =>
    request<import("./types").SimilarityResponse>(
      "/v1/similarity",
      { method: "POST", body: JSON.stringify({ id_a: idA, id_b: idB }) },
    ),

  fetchStats: () =>
    request<import("./types").StatsResponse>("/v1/stats"),
};