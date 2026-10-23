import os
from datetime import datetime
from dotenv import load_dotenv
from sqlalchemy import (create_engine, Column, String, Integer, Float,
                        DateTime, JSON, ForeignKey)
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./bodacredit.db")

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False)
Base = declarative_base()


class Rider(Base):
    __tablename__ = "riders"

    national_id             = Column(String, primary_key=True)
    full_name               = Column(String, nullable=False)
    phone_number            = Column(String)
    rider_segment           = Column(String)
    bike_ownership          = Column(String)
    is_sacco_member         = Column(Integer, default=0)
    sacco_tenure_months     = Column(Integer, default=0)
    sacco_contribution_rate = Column(Float, default=0)
    total_loans_taken       = Column(Integer, default=0)
    on_time_repayment_rate  = Column(Float, default=0.75)
    ever_defaulted          = Column(Integer, default=0)
    active_digital_loans    = Column(Integer, default=0)
    created_at              = Column(DateTime, default=datetime.utcnow)
    updated_at              = Column(DateTime, default=datetime.utcnow,
                                     onupdate=datetime.utcnow)


class Application(Base):
    __tablename__ = "applications"

    id                 = Column(String, primary_key=True)
    national_id        = Column(String, ForeignKey("riders.national_id"), index=True)
    sacco_id           = Column(String, index=True)
    scored_by          = Column(String)
    rider_name         = Column(String)
    rider_segment      = Column(String)
    requested_amount   = Column(Float)
    requested_term_days = Column(Integer)
    avg_daily_income   = Column(Float)
    decision           = Column(String)
    pd_score           = Column(Float)
    recommended_amount = Column(Float)
    recommended_term_days = Column(Integer)
    daily_repayment    = Column(Float)
    officer_decision   = Column(String, nullable=True)
    officer_decided_by = Column(String, nullable=True)
    officer_decided_at = Column(DateTime, nullable=True)
    result_json        = Column(JSON)   # full scoring/recommendation/fairness response
    submitted_at       = Column(DateTime, default=datetime.utcnow)