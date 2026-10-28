"""v1/stats - public Milvus statistics dashboard API.

GET /api/my/v1/stats

Reports real Milvus collection metadata (schema, row count, index, load
state) plus measured latencies: a random-vector ANN search probe and a
local embedding probe. No invented statistics.
"""

import math
import random
import time

import veclib


def _search_probe(client, dim):
    """Measure real ANN search latency with a random unit vector."""
    vec = [random.uniform(-1.0, 1.0) for _ in range(dim)]
    norm = math.sqrt(sum(x * x for x in vec)) or 1.0
    vec = [x / norm for x in vec]
    started = time.perf_counter()
    state = "ok"
    try:
        veclib.search_vectors(client, vec, limit=1,
                              output_fields=["doc_id"])
    except Exception as exc:  # noqa: BLE001 - report the real failure
        state = "error: %s" % exc
    return veclib.ms_between(started), state


def main(args, ctx=None):
    if not ctx or not hasattr(ctx, "MILVUS"):
        return {"ok": False, "error": "Milvus is not configured for this action"}

    client = ctx.MILVUS

    try:
        ensured = veclib.ensure_collection(client)
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": "Milvus collection unavailable: %s" % exc}

    meta = veclib.collection_metadata(client)

    # Measured embedding latency (local in-code model).
    embed_start = time.perf_counter()
    try:
        veclib.embed("vector intelligence lab latency probe")
        embed_ms = veclib.ms_between(embed_start)
    except Exception as exc:  # noqa: BLE001
        embed_ms = None
        embed_state = "error: %s" % exc
    else:
        embed_state = "ok"

    # Measured ANN search latency probe.
    search_ms, search_state = _search_probe(client, int(meta.get("dim") or veclib.EMBED_DIM))

    return {
        "ok": True,
        "collection": meta.get("collection", veclib.COLLECTION),
        "row_count": meta.get("row_count"),
        "dim": meta.get("dim"),
        "load_state": meta.get("load_state"),
        "consistency_level": meta.get("consistency_level"),
        "collection_id": meta.get("collection_id"),
        "index": {
            "name": veclib.INDEX_NAME,
            "field": veclib.VECTOR_FIELD,
            "type": meta.get("index_type"),
            "metric": meta.get("metric_type"),
            "params": meta.get("index_params"),
            "state": meta.get("index_state"),
            "indexed_rows": meta.get("indexed_rows"),
        },
        "search_params": {"ef": veclib.SEARCH_EF},
        "fields": [f.get("name") for f in meta.get("fields", [])],
        "embedding_model": veclib.EMBED_MODEL,
        "latency": {
            "milvus_search_ms": search_ms,
            "search_probe": search_state,
            "embed_ms": embed_ms,
            "embed_probe": embed_state,
        },
        "categories": veclib.CATEGORIES,
        "note": (
            "Statistics come from live Milvus metadata; latencies are "
            "measured on the fly and can vary per request."
        ),
    }