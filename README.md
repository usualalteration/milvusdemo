# Milvus Vector Explorer — Vector Intelligence Lab

An interactive semantic search lab that demonstrates how a vector database
works: **React → Nuvolaris OpenServerless Python actions → Milvus**.

## What it demonstrates

- **Semantic Search Playground** — natural-language queries are embedded and
  matched by cosine similarity in Milvus, with a classic keyword search
  baseline for comparison and live proof that semantically related documents
  are found even when zero query keywords match.
- **Interactive Vector Space** — real document embeddings projected to 2D
  with PCA (computed server-side over stored vectors), with zoom, pan,
  hover details, per-category neon colors and query-to-neighbor links.
- **Document Collection Manager** — add documents (auto-embedded and indexed),
  browse, filter and delete them; inspect embedding vector samples.
- **Similarity Comparison** — pick any two documents and see their exact
  cosine similarity on an animated gauge, with shared semantic concepts.
- **Milvus Statistics** — collection name, vector count, dimensions, metric,
  index type, load state and measured search latency from live metadata.

## Architecture

| Layer | Detail |
| --- | --- |
| Frontend | React + TypeScript + Tailwind (Vite), `src/` |
| API | Relative `/api/my/v1/...` calls to OpenServerless actions |
| Actions | `packages/v1/{documents,search,vector-space,similarity,stats}` + `packages/setup/collection` |
| Vector DB | Milvus collection `vector_explorer_documents` (HNSW, COSINE, 512d) |

### Embedding model

The OpenServerless action runtime provides **no reachable external embedding
service**, so the app embeds documents and queries with a deterministic
**in-code model** (`local-concept-hybrid-v1`, 512 dims): a curated semantic
concept lexicon plus signed feature hashing over words, stems, bigrams and
character n-grams, L2-normalized. The identical model embeds documents at
seed/insert time and queries at search time, so dimensions always match.
If an embedding-capable Ollama endpoint is ever configured for the runtime,
the probe in the shared library will prefer it (dimension-compatible only).

### Persistence

- Milvus is the single source of truth. Nothing search-related is stored in
  the browser; refreshing re-reads from the vector index.
- `setup/collection` creates the collection if missing (never drops it) and
  seeds the 30 sample documents exactly once, guarded by a durable Redis
  seed marker built from `ctx.REDIS_PREFIX`.

## Development notes

- Actions live in `packages/<package>/<action>/`; only the non-`__main__.py`
  modules are editable app code. `veclib.py` is shared identically across
  action packages (serverless packaging is per-action).
- Offline embedding quality checks: `python3 tests/veclib_quality_check.py`.