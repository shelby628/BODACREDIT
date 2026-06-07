"""
BodaCredit — Scoring Pipeline Functions
Loaded by FastAPI backend on startup
"""

import numpy as np
import joblib
import json


def load_models(model_dir="models"):
    """Load all models and config from disk."""
    xgb_model = joblib.load(f"{model_dir}/xgb_model.pkl")
    lgb_model = joblib.load(f"{model_dir}/lgb_model.pkl")

    with open(f"{model_dir}/model_config.json", "r") as f:
        config = json.load(f)

    return xgb_model, lgb_model, config


def derive_features(rider_features: dict,
                    requested_amount: float,
                    requested_term_days: int) -> dict:
    """
    Derive all 54 features from the 16 raw inputs
    sent by the loan officer through the React form.

    This is where feature engineering lives in production.
    The frontend sends raw inputs.
    The backend derives everything else.
    """

    daily_income   = rider_features.get("avg_daily_income", 0)
    monthly_income = daily_income * 26
    fuel_monthly   = monthly_income * 0.30
    hire_fee       = 12000 if rider_features.get("bike_owned", 0) == 0 else 0
    food_est       = 3000
    remittance_est = 2000

    estimated_ndi = max(
        monthly_income - fuel_monthly - hire_fee - food_est - remittance_est,
        1000
    )

    sacco_tenure  = rider_features.get("sacco_tenure_months", 0)
    sacco_rate    = rider_features.get("sacco_contribution_rate", 0)
    total_loans   = rider_features.get("total_loans_taken", 0)
    digital_loans = rider_features.get("active_digital_loans", 0)
    on_time_rate  = rider_features.get("on_time_repayment_rate", 0.75)
    is_first_timer = 1 if total_loans == 0 else 0

    requested_monthly = requested_amount / max(requested_term_days / 30, 1)

    return {
        # ── Income features ───────────────────────────────────────────────
        "avg_daily_income":          daily_income,
        "total_income_90d":          daily_income * 90 * 0.92,
        "monthly_income_estimate":   monthly_income,
        "income_volatility_cv":      0.30,
        "income_trend_90d":          0.01,
        "rain_season_dip":           0.20,
        "income_gap_max_days":       3,

        # ── Expense features ──────────────────────────────────────────────
        "fuel_spend_monthly":        fuel_monthly,
        "fuel_to_income_ratio":      fuel_monthly / max(monthly_income, 1),
        "sacco_contrib_monthly":     sacco_rate * 2500
                                     if rider_features.get("is_sacco_member")
                                     else 0,
        "family_remittance_monthly": remittance_est,
        "digital_loan_monthly_out":  digital_loans * 500,
        "estimated_ndi":             estimated_ndi,
        "debt_service_ratio":        min(
                                         (digital_loans * 500) /
                                         max(monthly_income, 1),
                                         1.0
                                     ),
        "max_safe_repayment":        estimated_ndi * 0.30,
        "avg_mpesa_balance":         estimated_ndi * 0.15,
        "min_mpesa_balance":         0,
        "zero_balance_days":         3,

        # ── SACCO features ────────────────────────────────────────────────
        "sacco_tenure_months":       sacco_tenure,
        "sacco_contribution_rate":   sacco_rate,
        "sacco_on_time_rate":        sacco_rate * 0.90,
        "sacco_avg_days_late":       0.5 if sacco_rate > 0.80 else 3.0,
        "sacco_cumulative_savings":  sacco_tenure * sacco_rate * 2500,
        "sacco_guarantor_count":     1
                                     if rider_features.get("is_sacco_member")
                                     else 0,
        "sacco_repayment_status":    2.0,
        "is_sacco_member":           rider_features.get("is_sacco_member", 0),

        # ── Loan history features ─────────────────────────────────────────
        "total_loans_taken":         total_loans,
        "loans_repaid_clean":        round(total_loans * on_time_rate),
        "on_time_repayment_rate":    on_time_rate,
        "avg_days_early_late":       -1 if on_time_rate >= 0.90 else 5,
        "max_loan_repaid":           requested_amount * 0.8
                                     if total_loans > 0 else 0,
        "active_digital_loans":      digital_loans,
        "digital_loan_frequency":    digital_loans,
        "ever_defaulted":            rider_features.get("ever_defaulted", 0),
        "restructured_loan_flag":    0,
        "total_outstanding_debt":    digital_loans * 3000,
        "first_time_borrower":       is_first_timer,

        # ── Behavioural features ──────────────────────────────────────────
        "age":                       28,
        "months_operating":          12,
        "bike_age_years":            3.0,
        "bike_owned":                rider_features.get("bike_owned", 0),
        "has_app":                   rider_features.get("has_app", 0),
        "segment_risk_score":        rider_features.get("segment_risk_score", 3),
        "app_avg_weekly_trips":      42
                                     if rider_features.get("has_app")
                                     else 35,
        "app_avg_weekly_earnings":   daily_income * 7,
        "app_platform_rating":       4.5,
        "app_cancellation_rate":     0.06,
        "app_active_days_avg":       5.5,
        "app_peak_hour_ratio":       0.44,
        "app_income_stability_cv":   0.30,
        "loan_purpose_code":         rider_features.get("loan_purpose_code", 3),

        # ── Overborrowing ratios ──────────────────────────────────────────
        "loan_to_income_ratio":      round(
                                         requested_amount /
                                         max(monthly_income, 1), 4
                                     ),
        "loan_to_ndi_ratio":         round(
                                         requested_amount /
                                         max(estimated_ndi, 1), 4
                                     ),
        "repayment_to_ndi_ratio":    round(
                                         requested_monthly /
                                         max(estimated_ndi, 1), 4
                                     ),
    }


def validate_rider_data(rider_features):
    """Station 1: Validate incoming rider data."""
    errors   = []
    warnings = []

    if rider_features.get("avg_daily_income", 0) <= 0:
        errors.append(
            "No income transactions found — "
            "minimum 90 days M-Pesa history required"
        )
    if rider_features.get("estimated_ndi", 0) <= 0:
        errors.append(
            "Estimated net disposable income is zero or negative "
            "— cannot recommend loan"
        )
    if rider_features.get("debt_service_ratio", 0) > 0.80:
        errors.append(
            "Existing debt obligations exceed 80% of income "
            "— over-indebtedness detected"
        )
    if rider_features.get("avg_daily_income", 0) > 10000:
        warnings.append(
            "Unusually high daily income — manual verification recommended"
        )

    return {
        "is_valid": len(errors) == 0,
        "errors":   errors,
        "warnings": warnings,
    }


def prepare_features(rider_features, feature_cols):
    """Station 2: Build feature vector in correct order."""

    safe_defaults = {
        "avg_daily_income":          800.0,
        "total_income_90d":          72000.0,
        "income_volatility_cv":      0.35,
        "income_trend_90d":          0.0,
        "rain_season_dip":           0.20,
        "income_gap_max_days":       3,
        "monthly_income_estimate":   20800.0,
        "fuel_spend_monthly":        7000.0,
        "fuel_to_income_ratio":      0.30,
        "sacco_contrib_monthly":     0.0,
        "family_remittance_monthly": 2000.0,
        "digital_loan_monthly_out":  0.0,
        "estimated_ndi":             8000.0,
        "debt_service_ratio":        0.15,
        "max_safe_repayment":        2400.0,
        "avg_mpesa_balance":         1500.0,
        "min_mpesa_balance":         0.0,
        "zero_balance_days":         5,
        "sacco_tenure_months":       0,
        "sacco_contribution_rate":   0.0,
        "sacco_on_time_rate":        0.0,
        "sacco_avg_days_late":       0.0,
        "sacco_cumulative_savings":  0.0,
        "sacco_guarantor_count":     0,
        "sacco_repayment_status":    2.0,
        "is_sacco_member":           0,
        "total_loans_taken":         0,
        "loans_repaid_clean":        0,
        "on_time_repayment_rate":    0.75,
        "avg_days_early_late":       0.0,
        "max_loan_repaid":           0.0,
        "active_digital_loans":      0,
        "digital_loan_frequency":    0,
        "ever_defaulted":            0,
        "restructured_loan_flag":    0,
        "total_outstanding_debt":    0.0,
        "first_time_borrower":       1,
        "age":                       28,
        "months_operating":          12,
        "bike_age_years":            3.0,
        "bike_owned":                0,
        "has_app":                   0,
        "segment_risk_score":        3,
        "app_avg_weekly_trips":      35.0,
        "app_avg_weekly_earnings":   5000.0,
        "app_platform_rating":       4.5,
        "app_cancellation_rate":     0.06,
        "app_active_days_avg":       5.5,
        "app_peak_hour_ratio":       0.44,
        "app_income_stability_cv":   0.30,
        "loan_purpose_code":         3,
        "loan_to_income_ratio":      1.0,
        "loan_to_ndi_ratio":         2.0,
        "repayment_to_ndi_ratio":    0.60,
    }

    vector = []
    for feature in feature_cols:
        value = rider_features.get(
            feature,
            safe_defaults.get(feature, 0)
        )
        vector.append(float(value))

    return np.array(vector).reshape(1, -1)


def run_ml_scoring(feature_array, xgb_model, lgb_model,
                   xgb_weight, lgb_weight, threshold):
    """Station 3 and 4: Score and convert to credit score."""

    xgb_proba = float(xgb_model.predict_proba(feature_array)[0][1])
    lgb_proba = float(lgb_model.predict_proba(feature_array)[0][1])

    pd_score = float(np.clip(
        xgb_proba * xgb_weight + lgb_proba * lgb_weight,
        0.01, 0.99
    ))

    credit_score = round(100 - pd_score * 100, 1)

    if credit_score >= 80:
        risk_tier  = "LOW"
        risk_label = "Low Risk"
        action     = "APPROVE"
    elif credit_score >= 65:
        risk_tier  = "LOW-MEDIUM"
        risk_label = "Low-Medium Risk"
        action     = "APPROVE WITH CONDITIONS"
    elif credit_score >= 50:
        risk_tier  = "MEDIUM"
        risk_label = "Medium Risk"
        action     = "CONDITIONAL APPROVAL"
    elif credit_score >= 35:
        risk_tier  = "HIGH"
        risk_label = "High Risk"
        action     = "SENIOR REVIEW REQUIRED"
    else:
        risk_tier  = "VERY HIGH"
        risk_label = "Very High Risk"
        action     = "DECLINE"

    return {
        "xgb_probability": round(xgb_proba, 4),
        "lgb_probability": round(lgb_proba, 4),
        "pd_score":        round(pd_score, 4),
        "pd_percentage":   f"{pd_score * 100:.1f}%",
        "credit_score":    credit_score,
        "risk_tier":       risk_tier,
        "risk_label":      risk_label,
        "action":          action,
    }


def calculate_loan_recommendation(rider_features, scoring_result,
                                   requested_amount,
                                   requested_term_days):
    """Station 5: Calculate loan amount and term."""

    credit_score = scoring_result["credit_score"]
    risk_tier    = scoring_result["risk_tier"]
    ndi          = rider_features.get("estimated_ndi", 8000)
    first_timer  = rider_features.get("first_time_borrower", 1)
    max_repaid   = rider_features.get("max_loan_repaid", 0)

    if risk_tier == "VERY HIGH":
        return {
            "recommended_amount":    0,
            "recommended_term_days": 0,
            "monthly_repayment":     0,
            "daily_repayment":       0,
            "decision":              "DECLINE",
            "decline_reason":        "Credit score below minimum threshold",
            "condition":             None,
        }

    max_monthly = ndi * 0.30

    score_factors = {
        "LOW":        1.00,
        "LOW-MEDIUM": 0.85,
        "MEDIUM":     0.65,
        "HIGH":       0.45,
    }
    factor = score_factors.get(risk_tier, 0.65)

    adjusted_repayment = max_monthly * factor
    term_months        = requested_term_days / 30

    if first_timer:
        term_months = min(term_months, 3)
    if risk_tier == "HIGH":
        term_months = min(term_months, 2)

    term_months = max(term_months, 1)
    term_days   = int(term_months * 30)

    recommended_amount = adjusted_repayment * term_months

    if first_timer:
        recommended_amount = min(recommended_amount, 15000)
    if max_repaid > 0:
        recommended_amount = min(recommended_amount, max_repaid * 1.5)

    recommended_amount = max(recommended_amount, 3000)
    recommended_amount = round(recommended_amount / 500) * 500
    recommended_amount = min(recommended_amount, requested_amount)

    monthly_repayment = recommended_amount / term_months
    daily_repayment   = monthly_repayment / 30

    conditions = []
    if first_timer:
        conditions.append("Guarantor required — first loan")
    if risk_tier in ["MEDIUM", "HIGH"]:
        conditions.append("Guarantor required")
    if risk_tier == "HIGH":
        conditions.append("Senior officer approval required")
    if recommended_amount < requested_amount:
        conditions.append(
            f"Amount reduced from KES {requested_amount:,} "
            f"to KES {int(recommended_amount):,} "
            f"based on repayment capacity"
        )

    if risk_tier == "HIGH":
        decision = "SENIOR REVIEW REQUIRED"
    elif conditions:
        decision = "CONDITIONALLY APPROVED"
    else:
        decision = "APPROVED"

    return {
        "recommended_amount":    int(recommended_amount),
        "recommended_term_days": term_days,
        "monthly_repayment":     round(monthly_repayment, 2),
        "daily_repayment":       round(daily_repayment, 2),
        "decision":              decision,
        "decline_reason":        None,
        "condition":             " | ".join(conditions) if conditions else None,
    }