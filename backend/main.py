"""
BodaCredit — FastAPI Backend
Run with: uvicorn main:app --reload --port 8000
"""

import os
import warnings
from datetime import datetime, timedelta
from typing import Optional

import uvicorn
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
import bcrypt
from pydantic import BaseModel, Field

warnings.filterwarnings("ignore")

from pipeline.scoring import (
    calculate_loan_recommendation,
    derive_features,
    load_models,
    prepare_features,
    run_ml_scoring,
    validate_rider_data,
)
from pipeline.fairness import run_fairness_checks


# ─────────────────────────────────────────────
# ENVIRONMENT CONFIG
# ─────────────────────────────────────────────
# In production these come from Railway environment variables.
# Locally they fall back to safe defaults for development.

SECRET_KEY   = os.getenv("SECRET_KEY", "dev-secret-change-this-in-production")
ALGORITHM    = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8   # 8-hour sessions — one working day

# Allowed frontend origin. Set FRONTEND_URL in Railway env vars to your Vercel URL.
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")


# ─────────────────────────────────────────────
# APP SETUP
# ─────────────────────────────────────────────

app = FastAPI(
    title="BodaCredit Scoring API",
    description="Credit scoring for Nairobi boda-boda riders",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    # Locked to your frontend only — no longer wildcard "*"
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
@app.get("/health")
def health_check():
    return {"status": "ok"}


# ─────────────────────────────────────────────
# AUTH SETUP
# ─────────────────────────────────────────────

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# ── Hardcoded users store ─────────────────────────────────────────────────
# Each user has: username, hashed password, full name, sacco_id.
# sacco_id scopes what data each officer can see.
# To add a new SACCO officer:
#   1. Run: python -c "import bcrypt; print(bcrypt.hashpw('their_password'.encode(), bcrypt.gensalt()))"
#   2. Add the entry below.

USERS_DB = {
    "admin": {
        "username":        "admin",
        "full_name":       "Lawrence Ongaya",
        "sacco_id":        "SACCO-001",
        "hashed_password": "$2b$12$9iqEJEiohfK5hrtdYwBU/ulhzFMxDRoVSiugCv0r66uIhDSl.tm/e",
        "disabled":        False,
    },
}


# ─────────────────────────────────────────────
# AUTH HELPERS
# ─────────────────────────────────────────────

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())

def get_user(username: str) -> Optional[dict]:
    return USERS_DB.get(username)

def authenticate_user(username: str, password: str) -> Optional[dict]:
    user = get_user(username)
    if not user:
        return None
    if not verify_password(password, user["hashed_password"]):
        return None
    if user.get("disabled"):
        return None
    return user

def create_access_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token. Please log in again.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload  = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if not username:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = get_user(username)
    if not user or user.get("disabled"):
        raise credentials_exception
    return user


# ─────────────────────────────────────────────
# LOAD MODELS
# ─────────────────────────────────────────────

print("Loading BodaCredit models...")
xgb_model, lgb_model, model_config = load_models("models")

FEATURE_COLS = model_config["feature_cols"]
THRESHOLD    = model_config["threshold"]
XGB_WEIGHT   = model_config["xgb_weight"]
LGB_WEIGHT   = model_config["lgb_weight"]

print(f"✅ Models loaded — {len(FEATURE_COLS)} features")


# ─────────────────────────────────────────────
# SCHEMAS
# ─────────────────────────────────────────────

class ApplicationRequest(BaseModel):
    rider_id:             str
    rider_name:           str
    requested_amount:     float
    requested_term_days:  int
    application_month:    Optional[int] = None
    avg_daily_income:     float
    rider_segment:        str
    bike_ownership:       str
    loan_purpose:         str
    has_app:              Optional[int] = 0
    is_sacco_member:      int
    sacco_tenure_months:  int
    sacco_contribution_rate: float
    total_loans_taken:    int
    on_time_repayment_rate: float
    ever_defaulted:       int
    active_digital_loans: int
    first_time_borrower:  int


class TokenResponse(BaseModel):
    access_token: str
    token_type:   str
    officer_name: str
    sacco_id:     str


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

def build_raw_features(application: ApplicationRequest):
    return {
        "avg_daily_income":        application.avg_daily_income,
        "rider_segment":           application.rider_segment,
        "bike_ownership":          application.bike_ownership,
        "loan_purpose":            application.loan_purpose,
        "has_app":                 application.has_app,
        "is_sacco_member":         application.is_sacco_member,
        "sacco_tenure_months":     application.sacco_tenure_months,
        "sacco_contribution_rate": application.sacco_contribution_rate,
        "total_loans_taken":       application.total_loans_taken,
        "on_time_repayment_rate":  application.on_time_repayment_rate,
        "ever_defaulted":          application.ever_defaulted,
        "active_digital_loans":    application.active_digital_loans,
        "first_time_borrower":     application.first_time_borrower,
    }


def run_full_pipeline(application: ApplicationRequest):
    raw_features = build_raw_features(application)

    rider_features = derive_features(
        raw_features,
        application.requested_amount,
        application.requested_term_days,
    )

    validation = validate_rider_data(rider_features)

    if not validation["is_valid"]:
        raise HTTPException(
            status_code=422,
            detail={
                "message": "Validation failed",
                "errors":  validation["errors"],
            },
        )

    feature_array = prepare_features(rider_features, FEATURE_COLS)

    scoring = run_ml_scoring(
        feature_array,
        xgb_model,
        lgb_model,
        XGB_WEIGHT,
        LGB_WEIGHT,
        THRESHOLD,
    )

    fairness = run_fairness_checks(
        rider_features,
        scoring,
        application.requested_amount,
        application.application_month,
    )

    recommendation = calculate_loan_recommendation(
        rider_features,
        scoring,
        application.requested_amount,
        application.requested_term_days,
    )

    return {
        "rider_id":    application.rider_id,
        "rider_name":  application.rider_name,
        "valid":       True,
        "decision":    recommendation["decision"],
        "scoring":     scoring,
        "recommendation": recommendation,
        "fairness":    fairness,
        "validation":  validation,
    }


# ─────────────────────────────────────────────
# PUBLIC ENDPOINTS (no auth required)
# ─────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "status":  "running",
        "service": "BodaCredit Scoring API",
        "version": "1.0.0",
    }


@app.get("/health")
def health():
    """Public health check — used by frontend API status banner."""
    return {
        "status":        "healthy",
        "models_loaded": True,
        "features":      len(FEATURE_COLS),
        "threshold":     THRESHOLD,
    }


@app.post("/auth/login", response_model=TokenResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    Login endpoint. Accepts username + password, returns a JWT token.
    The frontend stores this token and sends it as a Bearer header on every request.
    """
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(data={
        "sub":      user["username"],
        "sacco_id": user["sacco_id"],
    })

    return {
        "access_token": token,
        "token_type":   "bearer",
        "officer_name": user["full_name"],
        "sacco_id":     user["sacco_id"],
    }


# ─────────────────────────────────────────────
# PROTECTED ENDPOINTS (auth required)
# ─────────────────────────────────────────────

@app.get("/model-info")
def model_info(current_user: dict = Depends(get_current_user)):
    """Model metadata — officers only."""
    return {
        "features":    len(FEATURE_COLS),
        "threshold":   THRESHOLD,
        "xgb_weight":  XGB_WEIGHT,
        "lgb_weight":  LGB_WEIGHT,
        "performance": model_config.get("performance", {}),
    }


@app.post("/score")
def score_application(
    application: ApplicationRequest,
    current_user: dict = Depends(get_current_user),   # ← protected
):
    """
    Score a loan application.
    Requires a valid Bearer token — unauthenticated requests return 401.
    The current_user is available here if you want to attach sacco_id to the record.
    """
    try:
        result = run_full_pipeline(application)
        # Attach the scoring officer's SACCO so records are scoped correctly
        result["scored_by"]  = current_user["username"]
        result["sacco_id"]   = current_user["sacco_id"]
        return result

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Scoring pipeline error: {str(e)}",
        )


@app.post("/validate")
def validate_only(
    application: ApplicationRequest,
    current_user: dict = Depends(get_current_user),   # ← protected
):
    """Validate inputs without scoring — officers only."""
    try:
        raw_features = build_raw_features(application)

        rider_features = derive_features(
            raw_features,
            application.requested_amount,
            application.requested_term_days,
        )

        validation = validate_rider_data(rider_features)

        return {
            "rider_id":  application.rider_id,
            "is_valid":  validation["is_valid"],
            "errors":    validation["errors"],
            "warnings":  validation["warnings"],
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Validation error: {str(e)}",
        )


@app.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    """Returns the logged-in officer's profile. Used by the frontend on load."""
    return {
        "username":  current_user["username"],
        "full_name": current_user["full_name"],
        "sacco_id":  current_user["sacco_id"],
    }
