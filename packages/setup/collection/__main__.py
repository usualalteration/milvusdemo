#--kind python:default
#--web false
# Note: this timeout is 5 minutes - 10 minutes is max allowed
#--timeout 300000
import types, os, collection

builder = []
## build-context ##
#--param REDIS_URL "$REDIS_URL"
#--param REDIS_PREFIX "$REDIS_PREFIX"
import redis
def init_redis(args, ctx):
  ctx.REDIS = redis.from_url(args.get("REDIS_URL", os.getenv("REDIS_URL")), decode_responses=True)
  ctx.REDIS_PREFIX = args.get("REDIS_PREFIX", os.getenv("REDIS_PREFIX"))
builder.append(init_redis)
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
    return { "body": collection.main(args, ctx=ctx) }
  except Exception as e:
    import traceback
    traceback.print_exc()
    return {
      "body": {"error": str(e) },
      "statusCode": 500
    }
