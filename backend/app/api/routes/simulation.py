from fastapi import APIRouter

from app.schemas.digital_twin import DigitalTwinScenario
from app.services.scenario import run_what_if
from app.simulation.disruption import run_monte_carlo_disruption

router = APIRouter()


@router.get("/disruptions")
def disruption_simulation() -> dict:
    return run_monte_carlo_disruption()


@router.post("/what-if")
def what_if_analysis(scenario: DigitalTwinScenario) -> dict:
    return run_what_if(scenario)
