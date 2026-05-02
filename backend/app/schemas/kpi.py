from pydantic import BaseModel


class KPIBundle(BaseModel):
    production: dict
    quality: dict
    commercial: dict
    inventory: dict
    financial: dict
    supply_chain: dict
