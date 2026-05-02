from app.kpi.engine import compute_kpis


def build_recommendations(quality_probability: float, churn_probability: float) -> list[dict]:
    kpis = compute_kpis()
    recs: list[dict] = []

    if quality_probability > 0.3:
        recs.append(
            {
                "title": "Ajuste de mezcla",
                "severity": "alta",
                "impact_area": "calidad",
                "recommendation": "Se recomienda mezclar el Lote A con el Lote C para bajar variabilidad de proteina y reducir merma por reproceso.",
            }
        )

    if kpis["inventory"]["stockout_probability"] > 0.1:
        recs.append(
            {
                "title": "Riesgo de inventario",
                "severity": "media",
                "impact_area": "inventario",
                "recommendation": "Se detecta riesgo de inventario en 14 dias. Incrementa inventario de seguridad en 12% para sostener abasto.",
            }
        )

    if churn_probability > 0.4:
        recs.append(
            {
                "title": "Retencion de clientes",
                "severity": "alta",
                "impact_area": "clientes",
                "recommendation": "El cliente X muestra patron de compra decreciente. Activa una campana de retencion con oferta focalizada por volumen.",
            }
        )

    if kpis["production"]["oee"] < 0.88:
        recs.append(
            {
                "title": "Eficiencia de produccion",
                "severity": "media",
                "impact_area": "operaciones",
                "recommendation": "La eficiencia de produccion cae 3%. Ejecuta mantenimiento preventivo en molienda para recuperar OEE y cumplir programa.",
            }
        )

    return recs
