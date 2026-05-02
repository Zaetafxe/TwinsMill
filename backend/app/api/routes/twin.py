from fastapi import APIRouter

from app.digital_twin.engine import MillingDigitalTwin
from app.schemas.digital_twin import (
    DigitalTwinResponse,
    DigitalTwinScenario,
    PhysicalModelInput,
    PhysicalModelOutput,
    TwinBlueprintResponse,
)
from app.services.twin_blueprint import get_twin_blueprint, run_physical_model

router = APIRouter()


@router.post("/run", response_model=DigitalTwinResponse)
def run_digital_twin(scenario: DigitalTwinScenario) -> DigitalTwinResponse:
    engine = MillingDigitalTwin()
    return engine.run(scenario)


@router.get("/blueprint", response_model=TwinBlueprintResponse)
def get_blueprint() -> TwinBlueprintResponse:
    return get_twin_blueprint()


@router.post("/physical-model/run", response_model=PhysicalModelOutput)
def run_physical(inputs: PhysicalModelInput) -> PhysicalModelOutput:
    return run_physical_model(inputs)
