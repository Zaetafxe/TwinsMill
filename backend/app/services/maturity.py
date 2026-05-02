def get_digital_maturity_score() -> dict:
    data_maturity = 78
    ai_maturity = 71
    operational_maturity = 83
    overall = round((data_maturity + ai_maturity + operational_maturity) / 3, 1)

    return {
        "data_maturity": data_maturity,
        "ai_maturity": ai_maturity,
        "operational_maturity": operational_maturity,
        "overall_score": overall,
        "benchmark": "Transformacion industrial de nivel medio-alto",
    }
