"""v1/vector-space - public PCA vector space visualization API.

GET /api/my/v1/vector-space

Projects all stored document embeddings onto their top-2 principal
components (real PCA over real Milvus embeddings) for the interactive
scatter plot.
"""

import time

import veclib


def main(args, ctx=None):
    if not ctx or not hasattr(ctx, "MILVUS"):
        return {"ok": False, "error": "Milvus is not configured for this action"}

    client = ctx.MILVUS
    started = time.perf_counter()

    try:
        veclib.ensure_collection(client)
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": "Milvus collection unavailable: %s" % exc}

    try:
        docs = veclib.fetch_documents(client, with_embedding=True)
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": "Failed to read documents: %s" % exc}

    try:
        projections = veclib.pca_project(
            [d.get(veclib.VECTOR_FIELD) for d in docs]
        )
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": "PCA projection failed: %s" % exc}

    points = []
    for doc, (x, y) in zip(docs, projections["points"]):
        points.append({
            "doc_id": doc.get("doc_id"),
            "title": doc.get("title", ""),
            "category": doc.get("category", ""),
            "x": x,
            "y": y,
        })

    return {
        "ok": True,
        "collection": veclib.COLLECTION,
        "count": len(points),
        "dim": veclib.EMBED_DIM,
        "method": projections["method"],
        "explained_variance": projections["explained_variance"],
        "points": points,
        "note": (
            "2D PCA projection of the 512-dimensional embedding space, "
            "not the original vectors."
        ),
        "elapsed_ms": veclib.ms_between(started),
    }