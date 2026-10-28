"""v1/similarity - public pairwise document similarity API.

POST/GET /api/my/v1/similarity  {id_a, id_b}

Fetches both stored embeddings from Milvus and computes the exact cosine
similarity between them.
"""

import veclib


def _bad(error, code=400):
    return {"ok": False, "error": error, "code": code}


def _summary(row):
    return {
        "doc_id": row.get("doc_id"),
        "title": row.get("title", ""),
        "category": row.get("category", ""),
        "content": row.get("content", ""),
        "concepts": (row.get("concepts") or "").split(",") if row.get("concepts") else [],
        "created_at": row.get("created_at", 0),
    }


def main(args, ctx=None):
    if not ctx or not hasattr(ctx, "MILVUS"):
        return {"ok": False, "error": "Milvus is not configured for this action"}

    client = ctx.MILVUS
    data = veclib.request_data(args)
    id_a = str(data.get("id_a") or data.get("idA") or data.get("a") or "").strip()
    id_b = str(data.get("id_b") or data.get("idB") or data.get("b") or "").strip()

    if not id_a or not id_b:
        return _bad("Two document ids (id_a, id_b) are required")
    if id_a == id_b:
        return _bad("Select two different documents")

    try:
        veclib.ensure_collection(client)
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": "Milvus collection unavailable: %s" % exc}

    try:
        rows = client.query(
            veclib.COLLECTION,
            filter='doc_id in ["%s", "%s"]' % (
                veclib.escape_filter(id_a), veclib.escape_filter(id_b)
            ),
            output_fields=[
                "doc_id", "title", "category", "content", "concepts",
                "created_at", veclib.VECTOR_FIELD,
            ],
            limit=2,
        )
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": "Failed to read documents: %s" % exc}

    by_id = {r.get("doc_id"): r for r in rows}
    if id_a not in by_id:
        return _bad("Document not found: %s" % id_a, code=404)
    if id_b not in by_id:
        return _bad("Document not found: %s" % id_b, code=404)

    vec_a = by_id[id_a].get(veclib.VECTOR_FIELD) or []
    vec_b = by_id[id_b].get(veclib.VECTOR_FIELD) or []
    if not vec_a or not vec_b:
        return {"ok": False, "error": "Stored embedding missing for one of the documents"}

    score = veclib.cosine_similarity(vec_a, vec_b)
    concepts_a = set(by_id[id_a].get("concepts", "").split(","))
    concepts_b = set(by_id[id_b].get("concepts", "").split(","))

    return {
        "ok": True,
        "score": round(score, 4),
        "score_percent": round(max(0.0, min(1.0, score)) * 100.0, 1),
        "method": "cosine",
        "metric_note": (
            "Cosine similarity measures the angle between embeddings: 1 means "
            "identical direction, 0 orthogonal, negative means opposite. "
            "Milvus stores vectors and returns COSINE distances; this score "
            "is computed from the stored embeddings directly."
        ),
        "shared_concepts": sorted(concepts_a & concepts_b)[:16],
        "doc_a": _summary(by_id[id_a]),
        "doc_b": _summary(by_id[id_b]),
        "dim": veclib.EMBED_DIM,
    }