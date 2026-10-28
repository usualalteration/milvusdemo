#--kind python:default
#--web true
# Note: this timeout is 5 minutes - 10 minutes is max allowed
#--timeout 300000
import types, os, stats

builder = []
## build-context ##
#--param MILVUS_HOST "$MILVUS_HOST"
#--param MILVUS_PORT "$MILVUS_PORT"
#--param MILVUS_DB_NAME "$MILVUS_DB_NAME"
#--param MILVUS_TOKEN "$MILVUS_TOKEN"
from pymilvus import MilvusClient
def init_milvus(args, ctx):
  host = args.get('MILVUS_HOST', os.getenv('MILVUS_HOST'))
  port = args.get('MILVUS_PORT', os.getenv('MILVUS_PORT'))
  uri = f"http://{host}:{port}"
  token = args.get("MILVUS_TOKEN", os.getenv("MILVUS_TOKEN"))
  db_name = args.get("MILVUS_DB_NAME", os.getenv("MILVUS_DB_NAME"))
  ctx.MILVUS = MilvusClient(uri=uri, token=token, db_name=db_name)
builder.append(init_milvus)

def main(args):
  try:
    ctx = types.SimpleNamespace()
    for fn in builder: fn(args, ctx)
    return { "body": stats.main(args, ctx=ctx) }
  except Exception as e:
    import traceback
    traceback.print_exc()
    return {
      "body": {"error": str(e) },
      "statusCode": 500
    }
