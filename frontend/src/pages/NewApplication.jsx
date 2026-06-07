import { useState, Component, useEffect } from "react";
import { Link } from "react-router-dom";
import { useLoanContext } from "../context/LoanContext";
import { getRiderByID, getAllLoans } from "../utils/loanStore";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

// ── Error Boundary ─────────────────────────────────────────────────────────
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }
  static getDerivedStateFromError(err) {
    return { hasError: true, message: err.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 m-6 text-red-800">
          <p className="font-bold text-lg mb-2">⚠️ Render Error</p>
          <p className="text-sm font-mono">{this.state.message}</p>
          <p className="text-sm mt-3 text-red-600">
            Check the browser console and Network tab for details.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────
const fmt = (v) =>
  (typeof v === "number" && !isNaN(v) ? v : 0).toLocaleString();

const getRiskTier = (pd) =>
  pd < 0.20 ? "LOW"
  : pd < 0.35 ? "LOW-MEDIUM"
  : pd < 0.50 ? "MEDIUM"
  : pd < 0.65 ? "HIGH"
  : "VERY HIGH";

const getRiskColor = (tier) =>
  ({
    "LOW":        "bg-green-100 text-green-800 border-green-200",
    "LOW-MEDIUM": "bg-green-100 text-green-800 border-green-200",
    "MEDIUM":     "bg-yellow-100 text-yellow-800 border-yellow-200",
    "HIGH":       "bg-orange-100 text-orange-800 border-orange-200",
    "VERY HIGH":  "bg-red-100 text-red-800 border-red-200",
  })[tier] ?? "bg-gray-100 text-gray-800";

const getRiskEmoji = (tier) =>
  ({
    "LOW":        "🟢",
    "LOW-MEDIUM": "🟢",
    "MEDIUM":     "🟡",
    "HIGH":       "🟠",
    "VERY HIGH":  "🔴",
  })[tier] ?? "⚪";

const getDecisionStyle = (decision) => {
  if (!decision) return "";
  const d = decision.toUpperCase();
  if (d === "APPROVE" || d === "APPROVED")
    return "bg-green-50 border-green-200 text-green-800";
  if (d === "DECLINE" || d === "DECLINED" || d === "HARD_BLOCK")
    return "bg-red-50 border-red-200 text-red-800";
  return "bg-yellow-50 border-yellow-200 text-yellow-800";
};

const getDecisionEmoji = (decision) => {
  if (!decision) return "⚪";
  const d = decision.toUpperCase();
  if (d === "APPROVE" || d === "APPROVED") return "✅";
  if (d === "DECLINE" || d === "DECLINED" || d === "HARD_BLOCK") return "🚫";
  return "";
};

// ── Default form state ─────────────────────────────────────────────────────
const defaultForm = () => ({
  national_id:             "",
  full_name:               "",
  phone_number:            "",
  rider_segment:           "Stage Rider",
  bike_ownership:          "Hired",
  requested_amount:        "",
  requested_term_days:     "90",
  loan_purpose:            "Bike Repair",
  application_month:       String(new Date().getMonth() + 1),
  avg_daily_income:        "",
  is_sacco_member:         "0",
  sacco_tenure_months:     "0",
  sacco_contribution_rate: "0",
  total_loans_taken:       "0",
  on_time_repayment_rate:  "0.75",
  ever_defaulted:          "0",
  active_digital_loans:    "0",
});

const STEP_LABELS = [
  "Rider Identity",
  "Loan Request",
  "Income",
  "SACCO & History",
  "Decision",
];

// ── Component ──────────────────────────────────────────────────────────────
export default function NewApplication() {
  const [step,     setStep]     = useState(1);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [result,   setResult]   = useState(null);
  const [formData, setFormData] = useState(defaultForm);
  const [returningRider, setReturningRider] = useState(null);
  const { addApplication }      = useLoanContext();

  // ── RETURNING RIDER DETECTION ─────────────────────────────────────────
  useEffect(() => {
    const checkReturningRider = async () => {
      const nationalId = formData.national_id.trim();
      if (nationalId.length >= 6) {
        const existingRider = getRiderByID(nationalId);
        if (existingRider) {
          const allLoans = getAllLoans();
          const riderLoans = allLoans.filter(loan => 
            loan.national_id === nationalId || loan.rider_id?.includes(nationalId)
          );
          
          setReturningRider({
            profile: existingRider,
            loanCount: riderLoans.length,
            previousLoans: riderLoans
          });
          
          setFormData(prev => ({
            ...prev,
            full_name: existingRider.full_name || prev.full_name,
            phone_number: existingRider.phone_number || prev.phone_number,
            rider_segment: existingRider.rider_segment || prev.rider_segment,
            bike_ownership: existingRider.bike_ownership || prev.bike_ownership,
            total_loans_taken: String((existingRider.total_loans_taken || 0) + 1),
            on_time_repayment_rate: String(existingRider.on_time_repayment_rate || "0.75"),
            ever_defaulted: String(existingRider.ever_defaulted || "0"),
            active_digital_loans: String(existingRider.active_digital_loans || "0"),
            is_sacco_member: String(existingRider.is_sacco_member || "0"),
            sacco_tenure_months: String(existingRider.sacco_tenure_months || "0"),
            sacco_contribution_rate: String(existingRider.sacco_contribution_rate || "0"),
          }));
        } else {
          setReturningRider(null);
        }
      } else {
        setReturningRider(null);
      }
    };
    
    const timeoutId = setTimeout(checkReturningRider, 500);
    return () => clearTimeout(timeoutId);
  }, [formData.national_id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      if (name === "total_loans_taken") {
        updated.on_time_repayment_rate =
          value === "0" ? "0.75" : prev.on_time_repayment_rate;
      }
      if (name === "is_sacco_member" && value === "0") {
        updated.sacco_tenure_months     = "0";
        updated.sacco_contribution_rate = "0";
      }
      return updated;
    });
  };

  const nextStep = () => { setError(null); setStep((s) => Math.min(s + 1, 5)); };
  const prevStep = () => { setError(null); setStep((s) => Math.max(s - 1, 1)); };

  // ── Submit ─────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setError(null);

    if (!formData.full_name.trim()) {
      setError("Please enter the rider's full name.");
      return;
    }
    if (!formData.avg_daily_income || parseFloat(formData.avg_daily_income) <= 0) {
      setError("Please enter a valid average daily income.");
      return;
    }
    if (!formData.requested_amount || parseFloat(formData.requested_amount) <= 0) {
      setError("Please enter a valid requested loan amount.");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        rider_id:                `RDR-${Date.now()}`,
        national_id:             formData.national_id,
        rider_name:              formData.full_name,
        phone_number:            formData.phone_number,
        rider_segment:           formData.rider_segment,
        bike_ownership:          formData.bike_ownership,
        requested_amount:        parseFloat(formData.requested_amount),
        requested_term_days:     parseInt(formData.requested_term_days),
        loan_purpose:            formData.loan_purpose,
        application_month:       parseInt(formData.application_month),
        avg_daily_income:        parseFloat(formData.avg_daily_income) || 0,
        is_sacco_member:         parseInt(formData.is_sacco_member),
        sacco_tenure_months:     parseInt(formData.sacco_tenure_months),
        sacco_contribution_rate: parseFloat(formData.sacco_contribution_rate),
        total_loans_taken:       parseInt(formData.total_loans_taken),
        on_time_repayment_rate:  parseFloat(formData.on_time_repayment_rate),
        ever_defaulted:          parseInt(formData.ever_defaulted),
        active_digital_loans:    parseInt(formData.active_digital_loans),
        first_time_borrower:     formData.total_loans_taken === "0" ? 1 : 0,
        previous_loan_count:     returningRider?.loanCount || 0,
      };

      const token = localStorage.getItem("bodacredit_token");

const response = await fetch(`${API_URL}/score`, {
  method:  "POST",
  headers: {
    "Content-Type":  "application/json",
    "Authorization": `Bearer ${token}`,
  },
  body: JSON.stringify(payload),
});

      const data = await response.json();

      if (!response.ok) {
        const msg = Array.isArray(data.detail)
          ? data.detail.map((e) => `${e.loc?.slice(-1)[0] ?? "field"}: ${e.msg}`).join("\n")
          : data.detail ?? "Scoring failed. Check FastAPI server.";
        setError(msg);
      } else {
        addApplication({
          applied_at:            new Date().toISOString(),
          national_id:           formData.national_id,
          rider_name:            payload.rider_name,
          rider_id:              payload.rider_id,
          phone_number:          payload.phone_number,
          rider_segment:         payload.rider_segment,
          bike_ownership:        payload.bike_ownership,
          requested_amount:      payload.requested_amount,
          requested_term_days:   payload.requested_term_days,
          avg_daily_income:      payload.avg_daily_income,
          decision:              data.decision,
          pd_score:              data.scoring?.pd_score,
          recommended_amount:    data.recommendation?.recommended_amount,
          daily_repayment:       data.recommendation?.daily_repayment,
          scoring:               data.scoring,
          recommendation:        data.recommendation,
          fairness:              data.fairness,
          is_sacco_member:       payload.is_sacco_member,
          sacco_tenure_months:   payload.sacco_tenure_months,
          sacco_contribution_rate: payload.sacco_contribution_rate,
          total_loans_taken:     payload.total_loans_taken,
          on_time_repayment_rate: payload.on_time_repayment_rate,
          ever_defaulted:        payload.ever_defaulted,
          active_digital_loans:  payload.active_digital_loans,
          is_returning_rider: !!returningRider,
        });

        setResult(data);
        setStep(5);
      }
    } catch (err) {
      console.error("Score API error:", err);
      setError("Cannot connect to scoring engine. Is FastAPI running on port 8000?");
    } finally {
      setLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <ErrorBoundary>
      <div className="min-h-screen flex bg-[#f6f7f9] text-gray-900">
        
        {/* SIDEBAR */}
        <aside className="w-64 bg-[#111827] text-white p-5 flex-shrink-0">
          <h1 className="text-2xl font-bold text-[#235347]">BodaCredit</h1>

          <div className="mt-10 space-y-2 text-sm">
            {/* Back button */}
            

            {/* Divider line */}
            <div className="border-t border-gray-700 my-2"></div>
            
            
            
        
            
            
          </div>

          {/* STEP INDICATORS */}
          <div className="mt-12 space-y-3 text-xs text-gray-400">
            {STEP_LABELS.map((label, i) => (
              <div key={label}
                className={`flex items-center gap-2 ${
                  step === i + 1 ? "text-white font-semibold" : ""
                }`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center
                                  text-xs font-bold ${
                  step > i + 1
                    ? "bg-green-500 text-white"
                    : step === i + 1
                    ? "bg-[#235347] text-white"
                    : "bg-gray-700 text-gray-400"
                }`}>
                  {step > i + 1 ? "✓" : i + 1}
                </span>
                {label}
              </div>
              
            ))}
          </div>

<div className="mt-auto pt-6 border-t border-gray-700">
  <button
    onClick={() => window.history.back()}
    className="w-full flex items-center gap-2 px-3 py-2 rounded 
               hover:bg-gray-800 text-white transition"
  >
    <span>Back</span>
  </button>
</div>
          
        </aside>

        {/* MAIN */}
        <main className="flex-1 p-8 overflow-y-auto">
          <div className="mb-6">
            <h2 className="text-3xl font-bold">New Loan Application</h2>
            <p className="text-gray-500 mt-1">
              Step {step} of 5 — {STEP_LABELS[step - 1]}
            </p>
          </div>

          {/* PROGRESS BAR */}
          <div className="w-full bg-gray-200 h-2 rounded-full mb-8">
            <div
              className="h-2 bg-[#235347] rounded-full transition-all duration-500"
              style={{ width: `${(step / 5) * 100}%` }}
            />
          </div>

          {/* FORM CARD */}
          <div className="bg-white border rounded-xl p-6 max-w-3xl">
            {/* RETURNING RIDER BANNER */}
            {returningRider && step < 5 && (
              <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">🔄</span>
                  <div className="flex-1">
                    <p className="font-semibold text-blue-900">Returning Rider Detected</p>
                    <p className="text-sm text-blue-700 mt-1">
                      {returningRider.profile.full_name} — {returningRider.loanCount} previous loan(s) found.
                      Form has been pre-filled with their information.
                    </p>
                    {returningRider.previousLoans.length > 0 && (
                      <p className="text-xs text-blue-600 mt-2">
                        Last loan: {new Date(returningRider.previousLoans[0]?.applied_at).toLocaleDateString("en-KE", {
  day: "numeric", month: "short", year: "numeric"
})}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setReturningRider(null)}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            {/* STEP 1: RIDER IDENTITY */}
            {step === 1 && (
              <>
                <h3 className="text-lg font-semibold mb-1">Rider Identity</h3>
                <p className="text-sm text-gray-500 mb-5">
                  Basic information about the rider applying for the loan.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      National ID Number * (Enter to check for returning rider)
                    </label>
                    <input
                      name="national_id"
                      placeholder="e.g. 12345678"
                      value={formData.national_id}
                      onChange={handleChange}
                      className="w-full border border-gray-300 p-3 rounded-lg text-sm
                                 focus:outline-none focus:ring-2 focus:ring-[#7A4988]"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      System will auto-detect returning riders and pre-fill their information
                    </p>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name *
                    </label>
                    <input
                      name="full_name"
                      placeholder="e.g. John Kamau Njoroge"
                      value={formData.full_name}
                      onChange={handleChange}
                      className="w-full border border-gray-300 p-3 rounded-lg text-sm
                                 focus:outline-none focus:ring-2 focus:ring-[#7A4988]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number
                    </label>
                    <input
                      name="phone_number"
                      placeholder="0712 345 678"
                      value={formData.phone_number}
                      onChange={handleChange}
                      className="w-full border border-gray-300 p-3 rounded-lg text-sm
                                 focus:outline-none focus:ring-2 focus:ring-[#7A4988]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Rider Segment
                    </label>
                    <select
                      name="rider_segment"
                      value={formData.rider_segment}
                      onChange={handleChange}
                      className="w-full border border-gray-300 p-3 rounded-lg text-sm
                                 focus:outline-none focus:ring-2 focus:ring-[#7A4988]"
                    >
                      {["Stage Rider","App Rider","Hybrid Rider","SACCO Member","Owner Rider"].map(
                        (s) => <option key={s}>{s}</option>
                      )}
                    </select>
                    <p className="text-xs text-gray-400 mt-1">
                      Stage = no app. App = Bolt/Little/SafeBoda. Hybrid = both.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bike Ownership
                    </label>
                    <select
                      name="bike_ownership"
                      value={formData.bike_ownership}
                      onChange={handleChange}
                      className="w-full border border-gray-300 p-3 rounded-lg text-sm
                                 focus:outline-none focus:ring-2 focus:ring-[#7A4988]"
                    >
                      <option value="Hired">Hired — pays daily fee</option>
                      <option value="Owned">Owned — no hire fee</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* STEP 2: LOAN REQUEST */}
            {step === 2 && (
              <>
                <h3 className="text-lg font-semibold mb-1">Loan Request</h3>
                <p className="text-sm text-gray-500 mb-5">
                  What the rider is applying for.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Amount Requested (KES) *
                    </label>
                    <input
                      name="requested_amount"
                      type="number"
                      placeholder="e.g. 20000"
                      value={formData.requested_amount}
                      onChange={handleChange}
                      className="w-full border border-gray-300 p-3 rounded-lg text-sm
                                 focus:outline-none focus:ring-2 focus:ring-[#7A4988]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Loan Term
                    </label>
                    <select
                      name="requested_term_days"
                      value={formData.requested_term_days}
                      onChange={handleChange}
                      className="w-full border border-gray-300 p-3 rounded-lg text-sm
                                 focus:outline-none focus:ring-2 focus:ring-[#7A4988]"
                    >
                      <option value="30">30 days — 1 month</option>
                      <option value="60">60 days — 2 months</option>
                      <option value="90">90 days — 3 months</option>
                      <option value="120">120 days — 4 months</option>
                      <option value="180">180 days — 6 months</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Loan Purpose
                    </label>
                    <select
                      name="loan_purpose"
                      value={formData.loan_purpose}
                      onChange={handleChange}
                      className="w-full border border-gray-300 p-3 rounded-lg text-sm
                                 focus:outline-none focus:ring-2 focus:ring-[#7A4988]"
                    >
                      {["Bike Repair","Working Capital","Bike Upgrade","Emergency","Bike Purchase"].map(
                        (p) => <option key={p}>{p}</option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Application Month
                    </label>
                    <select
                      name="application_month"
                      value={formData.application_month}
                      onChange={handleChange}
                      className="w-full border border-gray-300 p-3 rounded-lg text-sm
                                 focus:outline-none focus:ring-2 focus:ring-[#7A4988]"
                    >
                      {["January","February","March","April","May","June",
                        "July","August","September","October","November","December"].map(
                        (m, i) => <option key={m} value={i + 1}>{m}</option>
                      )}
                    </select>
                    <p className="text-xs text-gray-400 mt-1">
                      March–May and Oct–Nov are rain season — income dips not penalised.
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* STEP 3: INCOME */}
            {step === 3 && (
              <>
                <h3 className="text-lg font-semibold mb-1">Income Information</h3>
                <p className="text-sm text-gray-500 mb-5">
                  From the rider's M-Pesa statement — last 90 days.
                </p>
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Average Daily Income (KES) *
                    </label>
                    <input
                      name="avg_daily_income"
                      type="number"
                      placeholder="e.g. 900"
                      value={formData.avg_daily_income}
                      onChange={handleChange}
                      className="w-full border border-gray-300 p-3 rounded-lg text-sm
                                 focus:outline-none focus:ring-2 focus:ring-[#7A4988]"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Total M-Pesa income inflows ÷ active working days over last 90 days.
                    </p>
                  </div>

                  {formData.avg_daily_income && (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2 text-sm">
                      <p className="font-medium text-gray-700 mb-3">
                        Auto-calculated from daily income:
                      </p>
                      {(() => {
                        const daily = parseFloat(formData.avg_daily_income);
                        const monthly = daily * 26;
                        const fuel = monthly * 0.30;
                        const hire = formData.bike_ownership === "Hired" ? 12000 : 0;
                        const ndi = Math.max(monthly - fuel - hire - 3000 - 2000, 1000);
                        return (
                          <>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Monthly income estimate</span>
                              <span className="font-semibold">KES {monthly.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Fuel spend (30%)</span>
                              <span className="font-semibold text-red-600">
                                − KES {fuel.toLocaleString()}
                              </span>
                            </div>
                            {hire > 0 && (
                              <div className="flex justify-between">
                                <span className="text-gray-500">Hire fee (hired rider)</span>
                                <span className="font-semibold text-red-600">
                                  − KES {hire.toLocaleString()}
                                </span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span className="text-gray-500">Food + remittances (est.)</span>
                              <span className="font-semibold text-red-600">− KES 5,000</span>
                            </div>
                            <div className="flex justify-between border-t pt-2 mt-2">
                              <span className="font-semibold text-gray-800">
                                Net Disposable Income
                              </span>
                              <span className={`font-bold ${
                                ndi >= 8000 ? "text-green-700"
                                : ndi >= 4000 ? "text-yellow-700"
                                : "text-red-700"
                              }`}>
                                KES {ndi.toLocaleString()}
                              </span>
                            </div>
                            <div className="flex justify-between text-xs text-gray-400">
                              <span>Max safe monthly repayment (30% of NDI)</span>
                              <span>KES {(ndi * 0.30).toLocaleString()}</span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* STEP 4: SACCO & LOAN HISTORY */}
            {step === 4 && (
              <>
                <h3 className="text-lg font-semibold mb-1">SACCO & Loan History</h3>
                <p className="text-sm text-gray-500 mb-5">
                  From SACCO records and credit history.
                </p>
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Is this rider a SACCO member?
                      </label>
                      <div className="flex gap-3">
                        {["0", "1"].map((val) => (
                          <button key={val} type="button"
                            onClick={() =>
                              handleChange({ target: { name: "is_sacco_member", value: val } })
                            }
                            className={`flex-1 py-2 rounded-lg border text-sm font-medium
                                        transition ${
                              formData.is_sacco_member === val
                                ? "bg-[#7A4988] text-white border-[#7A4988]"
                                : "border-gray-300 text-gray-600 hover:bg-gray-50"
                            }`}>
                            {val === "1" ? "Yes — SACCO Member" : "No"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {formData.is_sacco_member === "1" && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Months as SACCO Member
                          </label>
                          <input
                            name="sacco_tenure_months"
                            type="number"
                            placeholder="e.g. 14"
                            value={formData.sacco_tenure_months}
                            onChange={handleChange}
                            className="w-full border border-gray-300 p-3 rounded-lg text-sm
                                       focus:outline-none focus:ring-2 focus:ring-[#7A4988]"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Contribution Discipline
                          </label>
                          <select
                            name="sacco_contribution_rate"
                            value={formData.sacco_contribution_rate}
                            onChange={handleChange}
                            className="w-full border border-gray-300 p-3 rounded-lg text-sm
                                       focus:outline-none focus:ring-2 focus:ring-[#7A4988]"
                          >
                            <option value="0.95">Excellent — contributes 95%+ of months</option>
                            <option value="0.80">Good — contributes about 80% of months</option>
                            <option value="0.65">Fair — contributes about 65% of months</option>
                            <option value="0.50">Poor — contributes about 50% of months</option>
                          </select>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Number of Prior Loans
                      </label>
                      <input
                        name="total_loans_taken"
                        type="number"
                        placeholder="0 if first time borrower"
                        value={formData.total_loans_taken}
                        onChange={handleChange}
                        className="w-full border border-gray-300 p-3 rounded-lg text-sm
                                   focus:outline-none focus:ring-2 focus:ring-[#7A4988]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Active Digital Loans
                      </label>
                      <select
                        name="active_digital_loans"
                        value={formData.active_digital_loans}
                        onChange={handleChange}
                        className="w-full border border-gray-300 p-3 rounded-lg text-sm
                                   focus:outline-none focus:ring-2 focus:ring-[#7A4988]"
                      >
                        <option value="0">None</option>
                        <option value="1">1 — Fuliza or Tala</option>
                        <option value="2">2 — multiple digital loans</option>
                        <option value="3">3+ — heavily indebted</option>
                      </select>
                    </div>

                    {formData.total_loans_taken === "0" ? (
                      <div className="col-span-2 bg-blue-50 border border-blue-200
                                      rounded-lg p-3 text-sm text-blue-700">
                        First time borrower — repayment rate set to neutral (0.75).
                        Not penalised for no history.
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Repayment Track Record
                          </label>
                          <select
                            name="on_time_repayment_rate"
                            value={formData.on_time_repayment_rate}
                            onChange={handleChange}
                            className="w-full border border-gray-300 p-3 rounded-lg text-sm
                                       focus:outline-none focus:ring-2 focus:ring-[#7A4988]"
                          >
                            <option value="1.00">Excellent — all loans repaid on time</option>
                            <option value="0.85">Good — mostly on time</option>
                            <option value="0.75">Average — some late payments</option>
                            <option value="0.60">Poor — often late</option>
                            <option value="0.40">Very poor — rarely repays on time</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Ever Defaulted on a Loan?
                          </label>
                          <div className="flex gap-3">
                            {["0", "1"].map((val) => (
                              <button key={val} type="button"
                                onClick={() =>
                                  handleChange({ target: { name: "ever_defaulted", value: val } })
                                }
                                className={`flex-1 py-2 rounded-lg border text-sm font-medium
                                            transition ${
                                  formData.ever_defaulted === val
                                    ? val === "1"
                                      ? "bg-red-600 text-white border-red-600"
                                      : "bg-green-600 text-white border-green-600"
                                    : "border-gray-300 text-gray-600 hover:bg-gray-50"
                                }`}>
                                {val === "1" ? "Yes — defaulted" : "No — clean"}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* STEP 5: DECISION */}
            {step === 5 && (
              <>
                {!result ? (
                  <div className="text-center py-8">
                    <div className="text-5xl mb-4">📋</div>
                    <h3 className="text-xl font-semibold mb-2">Ready to Score</h3>
                    <p className="text-gray-500 text-sm mb-6">
                      All details collected for{" "}
                      <strong>{formData.full_name || "this rider"}</strong>. Click
                      Submit to run the credit scoring pipeline.
                    </p>
                    <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2 text-sm mb-6">
                      {[
                        ["Rider", formData.full_name],
                        ["Segment", formData.rider_segment],
                        ["Amount Requested", `KES ${fmt(parseFloat(formData.requested_amount || 0))}`],
                        ["Daily Income", `KES ${fmt(parseFloat(formData.avg_daily_income || 0))}`],
                        ["Prior Loans", formData.total_loans_taken === "0"
                          ? "First time borrower"
                          : formData.total_loans_taken],
                      ].map(([label, val]) => (
                        <div key={label} className="flex justify-between">
                          <span className="text-gray-500">{label}</span>
                          <span className="font-medium">{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <h3 className="text-lg font-semibold">
                      Credit Decision — {result.rider_name ?? formData.full_name}
                    </h3>

                    {result.decision && (
                      <div className={`rounded-xl p-4 border ${getDecisionStyle(result.decision)}`}>
                        <p className="font-bold text-base">
                          {getDecisionEmoji(result.decision)} {result.decision}
                        </p>
                        {result.reason && <p className="text-sm mt-1">{result.reason}</p>}
                      </div>
                    )}

                    {result.scoring && (
                      <div className="bg-white border rounded-xl p-5">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <p className="text-4xl font-bold text-gray-900">
                              {Math.round((1 - result.scoring.pd_score) * 100)}
                              <span className="text-lg font-normal text-gray-400">/100</span>
                            </p>
                            <p className="text-sm text-gray-500 mt-1">
                              Default probability: {result.scoring.pd_percentage}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              XGB: {(result.scoring.xgb_probability * 100).toFixed(1)}% ·{" "}
                              LGB: {(result.scoring.lgb_probability * 100).toFixed(1)}%
                            </p>
                          </div>
                          {(() => {
                            const tier = getRiskTier(result.scoring.pd_score);
                            return (
                              <span className={`px-4 py-2 rounded-full border font-medium text-sm ${getRiskColor(tier)}`}>
                                {getRiskEmoji(tier)} {tier}
                              </span>
                            );
                          })()}
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-3">
                          <div
                            className="h-3 rounded-full transition-all duration-700"
                            style={{
                              width: `${Math.round((1 - result.scoring.pd_score) * 100)}%`,
                              backgroundColor: result.scoring.pd_score < 0.35 ? "#057a55" : result.scoring.pd_score < 0.50 ? "#c27803" : "#e02424",
                            }}
                          />
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => {
                        setResult(null);
                        setStep(1);
                        setFormData(defaultForm);
                        setReturningRider(null);
                      }}
                      className="w-full border border-gray-300 py-3 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
                    >
                      Score Another Rider
                    </button>
                  </div>
                )}
              </>
            )}

            {/* ERROR */}
            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm whitespace-pre-line">
                {error}
              </div>
            )}

            {/* NAV BUTTONS */}
            <div className="flex justify-between mt-8">
              <button
                onClick={prevStep}
                disabled={step === 1 || (step === 5 && !!result)}
                className="px-5 py-2 border border-gray-300 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-gray-50 transition"
              >
                Back
              </button>

              {step < 4 && (
                <button onClick={nextStep} className="px-6 py-2 bg-[#235347] text-white rounded-lg text-sm font-medium hover:bg-purple-800 transition">
                  Next →
                </button>
              )}

              {step === 4 && (
                <button onClick={nextStep} className="px-6 py-2 bg-[#235347] text-white rounded-lg text-sm font-medium hover:bg-purple-800 transition">
                  Review & Submit →
                </button>
              )}

              {step === 5 && !result && (
                <button onClick={handleSubmit} disabled={loading} className="px-6 py-2 bg-black text-white rounded-lg text-sm font-medium disabled:opacity-60 hover:bg-gray-800 transition flex items-center gap-2">
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Scoring...
                    </>
                  ) : (
                    "Submit for Scoring"
                  )}
                </button>
              )}
            </div>
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
}