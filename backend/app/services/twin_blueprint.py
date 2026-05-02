from __future__ import annotations

from dataclasses import dataclass

from app.schemas.digital_twin import (
    DataCoreSpec,
    KpiSpec,
    MathematicalEquation,
    PhysicalModelInput,
    PhysicalModelOutput,
    ProcessStageSpec,
    SensorSpec,
    StageMassBalance,
    TwinBlueprintResponse,
    TwinModelSpec,
)


@dataclass
class StagePhysics:
    name: str
    base_loss_pct: float


def clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


def get_twin_blueprint() -> TwinBlueprintResponse:
    stages = [
        ProcessStageSpec(
            name="Recepcion de grano",
            inputs=["Trigo/maiz", "Certificado de proveedor", "Temperatura ambiente"],
            outputs=["Lote recibido", "Muestra laboratorio", "Registro de trazabilidad"],
            critical_variables=["humedad_pct", "impurezas_pct", "temperatura_c", "densidad_kg_hl"],
            equipment=["Bascula camionera", "Calador automatico", "Tolvas de recepcion"],
            operational_risks=["Contaminacion cruzada", "Materia prima fuera de especificacion", "Errores de pesaje"],
        ),
        ProcessStageSpec(
            name="Limpieza",
            inputs=["Lote recibido", "Aire aspirado", "Setpoint de limpieza"],
            outputs=["Grano limpio", "Impurezas retiradas"],
            critical_variables=["caudal_t_h", "eficiencia_limpieza_pct", "carga_iman_gauss"],
            equipment=["Cribas", "Separadores", "Imanes", "Canal de aspiracion"],
            operational_risks=["Bypass de impurezas", "Saturacion de cribas", "Desgaste de imanes"],
        ),
        ProcessStageSpec(
            name="Acondicionamiento",
            inputs=["Grano limpio", "Agua de humidificacion", "Tiempo de reposo"],
            outputs=["Grano templado"],
            critical_variables=["humedad_objetivo_pct", "delta_humedad_pct", "tiempo_reposo_h"],
            equipment=["Dosificador de agua", "Rosca acondicionadora", "Silos de reposo"],
            operational_risks=["Sobrehumectacion", "Subhumectacion", "Fermentacion por reposo excesivo"],
        ),
        ProcessStageSpec(
            name="Molienda",
            inputs=["Grano templado", "Recirculado", "Setpoint de rodillos"],
            outputs=["Harina intermedia", "Semolas", "Salvado"],
            critical_variables=["velocidad_rodillos_rpm", "presion_bar", "gap_mm", "kwh_ton"],
            equipment=["Molinos de rodillos", "Alimentadores gravimetricos", "Sensores de vibracion"],
            operational_risks=["Sobrecalentamiento", "Rotura de rodillos", "Baja extraccion"],
        ),
        ProcessStageSpec(
            name="Cernido y purificacion",
            inputs=["Producto de molienda"],
            outputs=["Fracciones clasificadas", "Harina refinada"],
            critical_variables=["eficiencia_cernido_pct", "finura_um", "carga_plansifter"],
            equipment=["Plansifter", "Purificadores", "Transportadores neumaticos"],
            operational_risks=["Malla obstruida", "Mala separacion granulometrica", "Arrastre de salvado"],
        ),
        ProcessStageSpec(
            name="Reduccion y mezcla",
            inputs=["Fracciones intermedias", "Recetas de blend"],
            outputs=["Harina objetivo por cliente"],
            critical_variables=["proteina_pct", "cenizas_pct", "granulometria_cv_pct"],
            equipment=["Molinos de reduccion", "Mezcladores", "Tolvas pulmón"],
            operational_risks=["Desviacion de calidad", "Inestabilidad de mezcla", "Sobreconsumo energetico"],
        ),
        ProcessStageSpec(
            name="Almacenamiento y despacho",
            inputs=["Harina final", "Ordenes ERP/MES"],
            outputs=["Producto despachado", "Lote trazable de salida"],
            critical_variables=["stock_ton", "fill_rate_pct", "despachos_hora"],
            equipment=["Silos de harina", "Empaque", "Sistema de despacho"],
            operational_risks=["Quiebre de stock", "Demora logistica", "Error de trazabilidad"],
        ),
    ]

    sensors = [
        SensorSpec(process="Recepcion", variable="humedad_pct", sensor_type="NIR humedad", source="IoT/PLC", frequency_seconds=30),
        SensorSpec(process="Limpieza", variable="impurezas_pct", sensor_type="Vision + peso", source="IoT/SCADA", frequency_seconds=60),
        SensorSpec(process="Acondicionamiento", variable="temperatura_c", sensor_type="RTD PT100", source="PLC", frequency_seconds=10),
        SensorSpec(process="Molienda", variable="velocidad_rodillos_rpm", sensor_type="Encoder", source="PLC", frequency_seconds=1),
        SensorSpec(process="Molienda", variable="vibracion_mm_s", sensor_type="Acelerometro", source="IoT/SCADA", frequency_seconds=1),
        SensorSpec(process="Cernido", variable="granulometria_um", sensor_type="Analizador en linea", source="MES", frequency_seconds=120),
        SensorSpec(process="Mezcla", variable="proteina_pct", sensor_type="NIR proteina", source="MES/LIMS", frequency_seconds=180),
        SensorSpec(process="Despacho", variable="flujo_masa_t_h", sensor_type="Caudalimetro masa", source="ERP/MES", frequency_seconds=30),
    ]

    data_core = DataCoreSpec(
        capture_frequencies={
            "critical_control": "1s-10s",
            "quality_control": "2m-10m",
            "business_events": "por evento",
            "maintenance": "1s-60s",
        },
        time_series_structure={
            "timestamp": "datetime UTC",
            "asset_id": "linea/equipo",
            "process_stage": "etapa del molino",
            "variable": "nombre variable",
            "value": "float/string",
            "unit": "unidad de medida",
            "quality_flag": "good|suspect|bad",
        },
        integration_sources=["IoT industrial", "PLC/SCADA", "MES", "ERP (SAP)", "LIMS"],
    )

    kpis = [
        KpiSpec(name="Toneladas por hora", category="productividad", formula="throughput_tph = toneladas_procesadas / horas_operativas", unit="t/h", target=">= 22"),
        KpiSpec(name="Eficiencia molino", category="productividad", formula="eficiencia_pct = salida_util / entrada", unit="%", target=">= 94"),
        KpiSpec(name="OEE", category="productividad", formula="OEE = disponibilidad x rendimiento x calidad", unit="%", target=">= 85"),
        KpiSpec(name="Extraccion harina", category="calidad", formula="extraccion_pct = harina_final / trigo_entrada", unit="%", target="74-78"),
        KpiSpec(name="Variabilidad granulometria", category="calidad", formula="CV_granulometria = sigma / media", unit="%", target="<= 6"),
        KpiSpec(name="Desviacion proteina", category="calidad", formula="abs(proteina_real - proteina_objetivo)", unit="pp", target="<= 0.3"),
        KpiSpec(name="Energia por tonelada", category="costos", formula="energia_kwh_ton = kwh_totales / toneladas", unit="kWh/t", target="<= 58"),
        KpiSpec(name="Merma", category="costos", formula="merma_pct = (entrada - salida_total) / entrada", unit="%", target="<= 1.8"),
        KpiSpec(name="MTBF", category="mantenimiento", formula="horas_operacion / numero_fallas", unit="h", target=">= 220"),
        KpiSpec(name="MTTR", category="mantenimiento", formula="horas_paro / numero_fallas", unit="h", target="<= 2.5"),
    ]

    twin_model = TwinModelSpec(
        physical_model=[
            "Balance de masa por etapa",
            "Transferencia de humedad en acondicionamiento",
            "Modelo de energia especifica por molienda",
        ],
        mathematical_model=[
            "Ecuaciones deterministicas de rendimiento y calidad",
            "Reglas de negocio para limites operativos",
            "Modelo OEE con restricciones de capacidad",
        ],
        data_model=[
            "Historico de series temporales + eventos",
            "Feature store para entrenamiento ML",
            "Trazabilidad lote-a-lote",
        ],
        predictive_model=[
            "Prediccion de falla por vibracion/anomalias",
            "Forecast de demanda y mezcla optima",
            "Prediccion de calidad por lote",
        ],
        capabilities=[
            "Simulacion what-if operacional",
            "Optimizacion automatica de setpoints",
            "Prediccion de fallas y mantenimiento",
            "Recomendaciones operativas explicables",
        ],
    )

    equations = [
        MathematicalEquation(
            name="Balance de masa",
            expression="m_out_i = m_in_i * eta_i",
            description="Relacion basica por etapa con eficiencia eta_i.",
        ),
        MathematicalEquation(
            name="Ajuste de humedad",
            expression="agua_add_ton = m_in * max(0, H_target - H_in) * 0.0015",
            description="Agua adicionada para alcanzar humedad objetivo en acondicionamiento.",
        ),
        MathematicalEquation(
            name="Extraccion efectiva",
            expression="extraccion_eff = extraccion_obj * f(velocidad, presion, humedad)",
            description="Extraccion influenciada por setpoints de molienda y condicion del grano.",
        ),
        MathematicalEquation(
            name="OEE",
            expression="OEE = (t_operativo/t_planificado) * (throughput_real/throughput_nominal) * quality_rate",
            description="Indicador integrado de disponibilidad, rendimiento y calidad.",
        ),
    ]

    return TwinBlueprintResponse(
        process_stages=stages,
        sensors=sensors,
        data_core=data_core,
        kpis=kpis,
        twin_model=twin_model,
        equations=equations,
    )


def run_physical_model(inputs: PhysicalModelInput) -> PhysicalModelOutput:
    stages = [
        StagePhysics("Recepcion", 0.002),
        StagePhysics("Limpieza", 0.014),
        StagePhysics("Acondicionamiento", -0.004),
        StagePhysics("Molienda", 0.048),
        StagePhysics("Cernido", 0.012),
        StagePhysics("Purificacion", 0.009),
        StagePhysics("Reduccion", 0.006),
        StagePhysics("Mezcla", 0.003),
        StagePhysics("Almacenamiento y despacho", 0.004),
    ]

    mass = inputs.wheat_input_tons
    balance: list[StageMassBalance] = []

    moisture_penalty = clamp((inputs.wheat_moisture_pct - 13.5) * 0.002, -0.01, 0.02)
    pressure_gain = clamp((inputs.grinding_pressure_bar - 5.0) * 0.003, -0.01, 0.02)
    speed_gain = clamp((inputs.roller_speed_rpm - 450.0) / 1000.0, -0.02, 0.03)

    for stage in stages:
        stage_loss = stage.base_loss_pct + moisture_penalty

        if stage.name == "Acondicionamiento":
            water_gain = max(0.0, inputs.tempering_target_pct - inputs.wheat_moisture_pct) * 0.0015
            stage_loss = stage.base_loss_pct - water_gain

        if stage.name == "Molienda":
            stage_loss = stage.base_loss_pct - pressure_gain - speed_gain

        if stage.name == "Cernido":
            recovery = inputs.sifter_efficiency_pct / 100.0
            stage_loss = stage.base_loss_pct + (1.0 - recovery) * 0.08

        if stage.name == "Purificacion":
            recovery = inputs.purifier_efficiency_pct / 100.0
            stage_loss = stage.base_loss_pct + (1.0 - recovery) * 0.06

        stage_loss = clamp(stage_loss, -0.01, 0.12)

        output = mass * (1.0 - stage_loss)
        losses = mass - output
        balance.append(
            StageMassBalance(
                stage=stage.name,
                input_tons=round(mass, 3),
                output_tons=round(output, 3),
                losses_tons=round(losses, 3),
            )
        )
        mass = output

    extraction_real = clamp(
        (balance[-1].output_tons / inputs.wheat_input_tons) * 100.0,
        50.0,
        85.0,
    )

    operating_minutes = max(1, inputs.planned_time_minutes - inputs.downtime_minutes)
    throughput_tph = balance[-1].output_tons / (operating_minutes / 60.0)

    availability = operating_minutes / max(1, inputs.planned_time_minutes)
    performance = clamp(throughput_tph / 22.0, 0.5, 1.2)

    protein_score = clamp(1.0 - abs(inputs.quality_protein_pct - 11.5) * 0.08, 0.0, 1.0)
    ash_score = clamp(1.0 - abs(inputs.quality_ash_pct - 0.55) * 1.3, 0.0, 1.0)
    quality_rate = clamp((protein_score * 0.6) + (ash_score * 0.4), 0.0, 1.0)

    oee = availability * performance * quality_rate
    specific_energy = clamp(inputs.specific_energy_kwh_ton * (1.0 + moisture_penalty * 3.0), 20.0, 140.0)

    alerts: list[str] = []
    if extraction_real < inputs.extraction_target_pct - 1.5:
        alerts.append("Extraccion por debajo del objetivo: revisar gap, presion y acondicionamiento.")
    if specific_energy > 62:
        alerts.append("Consumo energetico alto: evaluar desgaste de rodillos y carga de molienda.")
    if oee < 0.82:
        alerts.append("OEE en zona de riesgo: priorizar disponibilidad y velocidad efectiva.")
    if quality_rate < 0.9:
        alerts.append("Riesgo de calidad: ajustar blend para proteina/cenizas objetivo.")

    kpis = {
        "throughput_tph": round(throughput_tph, 3),
        "extraction_pct": round(extraction_real, 3),
        "oee_pct": round(oee * 100.0, 2),
        "availability_pct": round(availability * 100.0, 2),
        "quality_rate_pct": round(quality_rate * 100.0, 2),
        "specific_energy_kwh_ton": round(specific_energy, 2),
        "estimated_flour_tons": round(balance[-1].output_tons, 3),
    }

    return PhysicalModelOutput(stage_balance=balance, kpis=kpis, alerts=alerts)
