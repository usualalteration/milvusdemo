# Trustant prompt
```
# Build Milvus Vector Explorer — An Interactive Semantic Search Lab

Create a complete, visually impressive **Milvus Vector Explorer** application using React, Tailwind CSS, Python actions on Nuvolaris OpenServerless, and Milvus.

Build and configure everything automatically using the available tools. Do not ask for confirmation between steps.

The application must demonstrate how a vector database works through an intuitive, interactive semantic search experience.

## Application Features

**1. Semantic Search Playground**

- Create a collection of 30 interesting sample documents covering technology, science, astronomy, artificial intelligence, music, and nature.
- Allow users to enter natural-language search queries.
- Convert queries into vector embeddings using an available embedding model.
- Search Milvus for the most semantically similar documents.
- Display the top five results with similarity scores, category badges, and highlighted content.
- Allow users to compare semantic search with traditional keyword search.
- Explain why semantically related documents can be found even without matching keywords.

**2. Interactive Vector Space**

- Visualize document embeddings as an interactive 2D scatter plot.
- Use PCA to project high-dimensional embeddings into two dimensions.
- Color points by document category.
- Highlight the nearest neighbors of the current search query.
- Display document titles and similarity scores when hovering over points.
- Support zooming, panning, and selecting individual vectors.
- Clearly indicate that the visualization is a 2D projection, not the original vector space.

**3. Document Collection Manager**

- Display all indexed documents in a searchable, filterable table.
- Allow users to add new documents with a title, category, and content.
- Automatically generate embeddings and insert new documents into Milvus.
- Allow users to delete documents.
- Show the vector dimension, collection name, and number of indexed documents.
- Provide a visual representation of an embedding vector, showing a sample of its numerical values.

**4. Similarity Comparison**

- Let users select two documents.
- Calculate cosine similarity between their embeddings.
- Display the similarity score using an animated circular gauge.
- Show both documents side by side.
- Explain the relationship between semantic similarity and vector distance.
- Display a simple comparison chart.

**5. Milvus Statistics**

Display a compact technical dashboard showing:

- Collection name
- Number of stored vectors
- Embedding dimensions
- Distance metric
- Index type
- Search latency
- Collection load status

Use real Milvus metadata and measured search latency wherever available. Do not invent statistics.

## Milvus Backend

Implement all backend functionality using Python actions on Nuvolaris OpenServerless.

- Connect to Milvus using the available `action_add_milvus` tool.
- Use the Milvus connection exposed by the OpenServerless runtime.
- Create a collection named `vector_explorer_documents` if it does not exist.
- Define a schema containing document ID, title, category, content, and embedding vector.
- Use an available embedding model and determine its vector dimension before creating the collection.
- Use the same embedding model for indexing documents and processing search queries.
- Configure an appropriate vector similarity index.
- Implement Python actions for document insertion, listing, deletion, vector search, similarity comparison, and statistics.
- Seed the sample documents only once.
- Use Milvus as the persistent vector storage system.
- Do not substitute mock search results or browser localStorage for real vector search.
- Validate inputs and handle errors gracefully.
- Avoid deleting or recreating existing collections during startup.
- Keep the implementation simple and reliable.

If an embedding service is not already configured, use an available local embedding model or an existing private AI endpoint. Do not silently use an external paid API or expose user data to third-party services.

## React Frontend and Visual Design

Build a premium interface inspired by **AI research laboratories, advanced developer tools, scientific visualization platforms, and modern analytics products**.

The application should look like a sophisticated AI product, not a standard CRUD dashboard.

**Visual direction**

- Deep obsidian background (`#080B14`).
- Electric cyan (`#00D9FF`), ultraviolet (`#8B5CF6`), and emerald (`#10B981`) accents.
- Glassmorphism panels with subtle transparency and backdrop blur.
- Animated gradient backgrounds and soft neon glow effects.
- Fine grid patterns inspired by scientific instruments.
- Large, elegant typography with clear information hierarchy.
- Rounded cards, thin luminous borders, and subtle shadows.
- Smooth microanimations using Framer Motion if available.
- Lucide icons for navigation and actions.

**Dashboard layout**

Create a responsive interface featuring:

- A compact left sidebar with the Milvus Vector Explorer logo.
- A top header titled **Vector Intelligence Lab**, with a live Milvus connection indicator.
- A prominent semantic search input with glowing focus effects.
- Search result cards with similarity score bars and category labels.
- A large interactive vector space visualization as the central visual element.
- A document collection browser with filtering and editing controls.
- A similarity comparison panel with an animated score gauge.
- A compact technical statistics area.

**Special UI interactions**

- Animate vector points when a search is performed.
- Draw subtle connecting lines between a query vector and its closest matches.
- Highlight search results in the vector plot.
- Use different neon colors for document categories.
- Animate similarity score indicators.
- Include polished loading states and skeleton screens.
- Add elegant toast notifications for completed operations.
- Provide helpful empty states and clear error messages.
- Make the application fully responsive for desktop, tablet, and mobile.

Use a combination of **dark scientific dashboard, glassmorphism, neon data visualization, and premium AI tooling design**.

## Integration and Verification

- Connect every React feature to real OpenServerless Python actions.
- Verify that Milvus stores and retrieves embeddings correctly.
- Test document insertion, vector similarity search, and deletion.
- Verify that new documents remain indexed after refreshing the browser.
- Ensure query embeddings and stored document embeddings use the same model and dimensions.
- Verify that nearest-neighbor search results are sorted according to the configured distance metric.
- Generate the 2D vector projection from real stored embeddings.
- Run the available backend and frontend validation tools and resolve detected errors.
- Display meaningful errors if Milvus or the embedding model is unavailable.

The final application must clearly demonstrate:

**React → Nuvolaris OpenServerless Python Actions → Milvus Vector Database**

Prioritize a visually memorable experience that helps users understand embeddings, semantic search, vector similarity, and the practical advantages of Milvus over traditional keyword-based search.

Build a fully functional application, not merely a visual prototype.
```

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
