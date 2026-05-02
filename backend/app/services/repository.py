from pymongo.database import Database

from app.db.session import get_db


def seed_synthetic_data(data: dict) -> dict:
    db: Database = get_db()

    inserted = {}
    for collection_name in [
        "wheat_lots",
        "production_batches",
        "quality_tests",
        "customers",
        "sales",
        "inventory",
        "energy_usage",
        "failures",
    ]:
        docs = data.get(collection_name, [])
        if not docs:
            inserted[collection_name] = 0
            continue
        result = db[collection_name].insert_many(docs)
        inserted[collection_name] = len(result.inserted_ids)

    db["pipelines"].insert_one({"steps": data.get("pipeline", [])})
    inserted["pipelines"] = 1
    return inserted
