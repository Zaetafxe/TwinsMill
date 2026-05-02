from pymongo import MongoClient
from pymongo.database import Database

from app.core.config import settings

# Agregar timeout para evitar cuelgues en conexión lenta
client = MongoClient(
    settings.mongodb_uri, 
    serverSelectionTimeoutMS=3000,  # 3 segundos timeout
    connectTimeoutMS=3000,
    socketTimeoutMS=3000,
    maxPoolSize=50,
    minPoolSize=5,
    maxIdleTimeMS=45000,
    appname="twinsmill-api",
)


def get_db() -> Database:
    return client[settings.mongodb_db]


def ensure_indexes() -> None:
    db = get_db()
    for collection_name in (
        "grain_receptions",
        "grain_milling_runs",
        "grain_packaging_runs",
        "grain_sales_runs",
        "ops_captures",
        "economic_scenarios",
    ):
        db[collection_name].create_index([("created_at", -1)])
