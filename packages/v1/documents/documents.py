"""v1/documents - public document collection manager API.

GET    /api/my/v1/documents        list all documents (+ embedding samples)
POST   /api/my/v1/documents        add a document (title, category, content)
DELETE /api/my/v1/documents/<id>   delete a document (id in route or body)
"""

import time
import uuid

import veclib

TITLE_MAX = 200
CATEGORY_MAX = 40
CONTENT_MAX = 4000
EMBEDDING_SAMPLE_SIZE = 12


def _bad(error, code=400):
    return {"ok": False, "error": error, "code": code}


def _doc_payload(row, include_sample=False):
    payload = {
        "doc_id": row.get("doc_id"),
        "title": row.get("title", ""),
        "category": row.get("category", ""),
        "content": row.get("content", ""),
        "concepts": (row.get("concepts") or "").split(",") if row.get("concepts") else [],
        "created_at": row.get("created_at", 0),
    }
    if include_sample:
        vector = row.get(veclib.VECTOR_FIELD) or []
        payload["dim"] = len(vector)
        payload["embedding_sample"] = [round(x, 4) for x in vector[:EMBEDDING_SAMPLE_SIZE]]
    return payload


def handle_list(client):
    rows = veclib.fetch_documents(client, with_embedding=True)
    rows = sorted(rows, key=lambda r: r.get("created_at", 0), reverse=True)
    documents = [_doc_payload(row, include_sample=True) for row in rows]
    return {
        "ok": True,
        "collection": veclib.COLLECTION,
        "total": len(documents),
        "dim": veclib.EMBED_DIM,
        "embedding_model": veclib.EMBED_MODEL["name"],
        "documents": documents,
    }


def handle_add(client, data):
    title = str(data.get("title") or "").strip()
    category = str(data.get("category") or "").strip()
    content = str(data.get("content") or "").strip()

    if not title:
        return _bad("A document title is required")
    if len(title) > TITLE_MAX:
        return _bad("Title must be at most %d characters" % TITLE_MAX)
    if not category:
        return _bad("A document category is required")
    if len(category) > CATEGORY_MAX:
        return _bad("Category must be at most %d characters" % CATEGORY_MAX)
    if not content:
        return _bad("Document content is required")
    if len(content) > CONTENT_MAX:
        return _bad("Content must be at most %d characters" % CONTENT_MAX)

    started = time.perf_counter()
    vector = veclib.embed("%s %s" % (title, content))
    embed_ms = veclib.ms_between(started)

    doc = {
        "doc_id": uuid.uuid4().hex[:16],
        "title": title,
        "category": category,
        "content": content,
        "concepts": ",".join(veclib.concepts_of("%s %s" % (title, content)))[:1000],
        "created_at": int(time.time()),
        "embedding": vector,
    }
    client.insert(veclib.COLLECTION, data=[doc])
    return {
        "ok": True,
        "document": {
            "doc_id": doc["doc_id"],
            "title": doc["title"],
            "category": doc["category"],
            "content": doc["content"],
            "concepts": doc["concepts"].split(",") if doc["concepts"] else [],
            "created_at": doc["created_at"],
            "dim": len(doc["embedding"]),
            "embedding_sample": [round(x, 4) for x in doc["embedding"][:EMBEDDING_SAMPLE_SIZE]],
        },
        "embed_ms": embed_ms,
        "embedding_model": veclib.EMBED_MODEL["name"],
    }


def handle_delete(client, doc_id):
    if not doc_id:
        return _bad("A document id is required")
    safe = veclib.escape_filter(doc_id)
    rows = client.query(
        veclib.COLLECTION,
        filter='doc_id == "%s"' % safe,
        output_fields=["doc_id", "title"],
        limit=1,
    )
    if not rows:
        return _bad("Document not found: %s" % doc_id, code=404)
    client.delete(veclib.COLLECTION, filter='doc_id == "%s"' % safe)
    remaining = veclib._count_rows(client)
    return {
        "ok": True,
        "deleted": doc_id,
        "title": rows[0].get("title", ""),
        "row_count": remaining,
    }


def main(args, ctx=None):
    if not ctx or not hasattr(ctx, "MILVUS"):
        return {"ok": False, "error": "Milvus is not configured for this action"}

    client = ctx.MILVUS
    try:
        veclib.ensure_collection(client)
    except Exception as exc:  # noqa: BLE001 - surface real Milvus errors
        return {"ok": False, "error": "Milvus collection unavailable: %s" % exc}

    method = veclib.request_method(args)
    data = veclib.request_data(args)

    try:
        if method == "POST":
            return handle_add(client, data)
        if method == "DELETE":
            doc_id = veclib.request_route_id(args, data, "documents")
            return handle_delete(client, doc_id)
        return handle_list(client)
    except Exception as exc:  # noqa: BLE001 - graceful error handling
        return {"ok": False, "error": "Document operation failed: %s" % exc}