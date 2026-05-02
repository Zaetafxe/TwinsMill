def answer_copilot(question: str) -> dict:
    q = question.lower()

    if "yield" in q or "rendimiento" in q:
        return {
            "answer": "El rendimiento esta bajando principalmente por variacion de humedad en lotes de entrada y aumento de paros en molienda. Accion recomendada: rebalancear mezcla con lotes de baja humedad y programar mantenimiento preventivo en 48 horas para contener merma.",
            "confidence": 0.89,
        }
    if "customers" in q or "clientes" in q or "risk" in q:
        return {
            "answer": "Los clientes CUST-OMEGA y CUST-SUR muestran riesgo alto de abandono por menor frecuencia de compra y presion de margen. Prioriza estabilizar nivel de servicio y lanzar ofertas comerciales focalizadas por segmento.",
            "confidence": 0.87,
        }
    if "production plan" in q or "plan" in q:
        return {
            "answer": "El mejor plan de esta semana es adelantar produccion en dias 2 y 3, reservar 14% de capacidad para volatilidad y ejecutar mezcla alta en proteina para SKUs premium con pedidos comprometidos.",
            "confidence": 0.85,
        }

    return {
        "answer": "El copiloto indica operaciones estables con riesgo medio de inventario. Se recomienda revisar intervalos de confianza del pronostico de demanda antes de cerrar plan maestro.",
        "confidence": 0.72,
    }
