"""v1/search - public semantic search playground API.

POST/GET /api/my/v1/search?query=...&limit=5

Runs a real Milvus vector similarity search over stored embeddings, a
classic keyword search for comparison, and returns the full PCA-projected
vector space so the frontend can draw query point and neighbor links.
"""

import time

import veclib

DEFAULT_LIMIT = 5
MAX_LIMIT = 20


def _bad(error, code=400):
    return {"ok": False, "error": error, "code": code}


def main(args, ctx=None):
    if not ctx or not hasattr(ctx, "MILVUS"):
        return {"ok": False, "error": "Milvus is not configured for this action"}

    client = ctx.MILVUS
    data = veclib.request_data(args)
    query = str(data.get("query") or data.get("q") or "").strip()

    if not query:
        return _bad("A search query is required")
    if len(query) > 500:
        return _bad("Query must be at most 500 characters")

    try:
        limit = int(data.get("limit") or DEFAULT_LIMIT)
    except (TypeError, ValueError):
        limit = DEFAULT_LIMIT
    limit = max(1, min(limit, MAX_LIMIT))

    total_start = time.perf_counter()

    try:
        veclib.ensure_collection(client)
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": "Milvus collection unavailable: %s" % exc}

    # --- 1. Embed the query with the same model as the documents ----------
    embed_start = time.perf_counter()
    try:
        query_vector = veclib.embed(query)
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": "Query embedding failed: %s" % exc}
    embed_ms = veclib.ms_between(embed_start)

    # --- 2. Milvus vector similarity search ------------------------------
    search_start = time.perf_counter()
    try:
        hits = veclib.search_vectors(client, query_vector, limit=limit)
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": "Milvus search failed: %s" % exc}
    search_ms = veclib.ms_between(search_start)

    query_concepts = set(veclib.concepts_of(query))
    q_stems = set(veclib.stems_of(query))

    results = []
    for rank, hit in enumerate(hits, start=1):
        entity = hit.get("entity", hit) if isinstance(hit, dict) else {}
        distance = hit.get("distance", 0.0) if isinstance(hit, dict) else 0.0
        content = str(entity.get("content", ""))
        doc_concepts = set(
            c for c in str(entity.get("concepts") or "").split(",") if c
        )
        matched_terms = sorted(
            term for term in q_stems if term in set(veclib.stems_of(content))
        )
        results.append({
            "rank": rank,
            "doc_id": entity.get("doc_id"),
            "title": entity.get("title", ""),
            "category": entity.get("category", ""),
            "content": content,
            "distance": round(float(distance), 4),
            "score": round(max(0.0, min(1.0, float(distance))) * 100.0, 1),
            "shared_concepts": sorted(query_concepts & doc_concepts)[:12],
            "matched_terms": matched_terms,
            "keyword_overlap": len(matched_terms),
        })

    # --- 3. Fetch all documents for keyword baseline + vector space -------
    fetch_start = time.perf_counter()
    docs = veclib.fetch_documents(client, with_embedding=True)
    fetch_ms = veclib.ms_between(fetch_start)

    keyword_results = veclib.keyword_rank(query, docs, top=5)

    # --- 4. PCA projection of the real stored embeddings -----------------
    pca_start = time.perf_counter()
    projections = veclib.pca_project(
        [d.get(veclib.VECTOR_FIELD) for d in docs],
        query_vector=query_vector,
    )
    pca_ms = veclib.ms_between(pca_start)

    neighbor_ids = {r["doc_id"] for r in results}
    score_by_id = {r["doc_id"]: r for r in results}
    points = []
    for doc, (x, y) in zip(docs, projections["points"]):
        hit = score_by_id.get(doc.get("doc_id"))
        points.append({
            "doc_id": doc.get("doc_id"),
            "title": doc.get("title", ""),
            "category": doc.get("category", ""),
            "x": x,
            "y": y,
            "is_neighbor": doc.get("doc_id") in neighbor_ids,
            "score": hit["score"] if hit else None,
            "rank": hit["rank"] if hit else None,
        })

    total_ms = veclib.ms_between(total_start)

    return {
        "ok": True,
        "query": query,
        "limit": limit,
        "embedding_model": veclib.EMBED_MODEL["name"],
        "dim": veclib.EMBED_DIM,
        "metric": veclib.METRIC_TYPE,
        "results": results,
        "keyword_results": keyword_results,
        "latency": {
            "embed_ms": embed_ms,
            "milvus_search_ms": search_ms,
            "fetch_ms": fetch_ms,
            "pca_ms": pca_ms,
            "total_ms": total_ms,
        },
        "vector_space": {
            "method": projections["method"],
            "explained_variance": projections["explained_variance"],
            "points": points,
            "query_point": projections["query"],
            "neighbor_ids": sorted(neighbor_ids),
            "note": (
                "2D PCA projection of the 512-dimensional embedding space, "
                "not the original vectors."
            ),
        },
    }