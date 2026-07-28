# BodaCredit

**AI-powered credit scoring for Nairobi's boda-boda riders.**

BodaCredit is a production-style underwriting system built for SACCOs and microfinance institutions lending to motorcycle taxi riders. It combines a dual machine-learning ensemble, automated fairness checks, and explainable, plain-English decisions into a single loan-officer workflow that returns a full credit decision in under 30 seconds.

**Live demo:** [creditscorebodaboda.vercel.app](https://creditscorebodaboda.vercel.app) — click **"Try Demo"** to sign in instantly with pre-filled credentials.

> Note: the backend is hosted on Render's free tier, which sleeps after inactivity. The first request after idle time may take 30–60 seconds to respond while it wakes up.

---

## Why this project exists

Boda-boda riders are a major part of Nairobi's informal economy, but most have no formal credit history — which makes them nearly invisible to traditional lenders. SACCOs want to serve them, but need a fast, defensible, and fair way to assess risk without a paper trail of payslips or bank statements.

BodaCredit closes that gap by scoring riders on the data they *do* generate — M-Pesa transaction patterns, SACCO membership and contribution history, and prior loan behavior — while explicitly guarding against the biases that typically hurt first-time borrowers and seasonal earners.

---

## Key features

- **Dual ML ensemble** — XGBoost and LightGBM run in parallel and are weighted together for a more stable prediction (0.82 AUC, 92.5% recall on defaulters)
- **54 engineered features** across five families: income stability, expense/capacity (including Net Disposable Income), savings discipline, loan history character, and behavioural signals — plus overborrowing ratios that judge requested amount relative to a rider's actual capacity, not a flat income threshold
- **Explainable decisions** — SHAP (TreeExplainer) generates plain-English reasoning for every score, so loan officers know exactly what drove an approval or decline
- **9 automated fairness checks**, including seasonal income adjustment for rain-season dips, first-time borrower protection (neutral rather than penalised), over-indebtedness hard blocks, and confirmation that gender is collected but never used in scoring (Kenya Data Protection Act, 2019 compliant)
- **M-Pesa statement parser (NLP)** — loan officers can paste a rider's raw M-Pesa SMS statement; the system segments it into transactions, classifies each one (income, fuel, food, savings, debt repayment, etc.), and auto-calculates average daily income — instead of manual entry
- **Rider memory** — returning riders are recognised by national ID and their history pre-fills automatically
- **Cookie-based session auth** — JWT stored in an httpOnly cookie, not localStorage, reducing exposure to XSS

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, Tailwind CSS |
| Backend | FastAPI, Pydantic |
| ML | XGBoost, LightGBM, SHAP |
| Auth | JWT (python-jose), bcrypt, httpOnly cookies |
| Hosting | Vercel (frontend), Render (backend) |

There is no traditional database — the system is intentionally stateless. Trained models are serialized as `.pkl` files (via `joblib`) and loaded once at server startup for performance.

---

## Architecture

```
React (Vite) ── fetch/cookies ──▶ FastAPI ──▶ pipeline/
                                              ├── scoring.py    (feature derivation, XGB+LGB ensemble, loan recommendation)
                                              ├── fairness.py   (9 automated fairness checks)
                                              └── mpesa_parser.py (M-Pesa statement → structured income data)
```

A key design decision: **the frontend sends only ~16 raw fields** entered by the loan officer. All 54 model features are derived server-side in `derive_features()` — feature engineering lives entirely in Python, not JavaScript, keeping the scoring logic auditable in one place.

### Scoring pipeline (6 stations)

1. Validate rider input
2. Derive the full 54-feature set from raw input
3. Run XGBoost + LightGBM, ensemble the probabilities
4. Convert to a 0–100 credit score and risk tier
5. Calculate loan recommendation (amount, term, daily repayment)
6. Run fairness checks and return the full decision with audit trail

### M-Pesa parser design

M-Pesa confirmation messages follow fixed Safaricom templates, so **structural extraction** (amount, date, transaction type, counterparty) is handled with regex — deterministic and fully auditable, which matters in a lending context where every number must be explainable. **Transaction classification** (is this fuel? income? savings?) is a rule-based keyword layer designed to be upgraded later (a trained classifier or LLM call) without touching the extraction logic beneath it. Unrecognised messages are surfaced as a count, not silently dropped, so officers know when to double-check.

---

## Data & model development

The model was trained on a synthetic dataset of 1,000 riders across 6 tables (riders, M-Pesa transactions, SACCO records, loan history, app trip data, credit applications), generated with a deterministic risk-scoring function and a data-driven 27% default rate. To keep the model realistic rather than artificially perfect, 15% label noise was deliberately added — an unmodified version of the synthetic data produced an unrealistic 0.99 AUC, which doesn't reflect real-world lending uncertainty. Class imbalance (75/25) was handled with `scale_pos_weight` rather than SMOTE, since SMOTE distorts the real-world probability-of-default estimates loan officers rely on.

---

## Getting started

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Create a `.env` file in `frontend/` pointing at your backend:

```
VITE_API_URL=http://127.0.0.1:8000
```

### Environment variables (backend)

| Variable | Purpose |
|---|---|
| `SECRET_KEY` | JWT signing key |
| `FRONTEND_URL` | Allowed CORS origin for the deployed frontend |

---

## Project status

Actively developed. Current focus areas: expanding M-Pesa message pattern coverage against real (anonymised) statements, and exploring a trained classifier to replace the rule-based transaction categoriser.

---

## Author

Built by Shelby Adede as an end-to-end ML + full-stack project — from synthetic data generation and model training through to a deployed, authenticated web application.
