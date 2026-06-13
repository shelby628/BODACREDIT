import { useState, Component, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLoanContext } from "../context/LoanContext";
import { getRiderByID, getAllLoans } from "../utils/loanStore";
import { useAuth } from "../context/AuthContext";

const API_URL = "https://bodacredit.onrender.com";

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

// ── Sidebar nav item (matches Dashboard) ──────────────────────────────────
const NavItem = ({ to, active, icon, children, onClick }) => (
  <Link
    to={to}
    onClick={onClick}
    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                transition-all duration-150 font-medium
                ${active
                  ? "text-white"
                  : "text-gray-400 hover:text-white hover:bg-white/5"}`}
    style={active ? { backgroundColor: "#235347" } : {}}>
    <span className="text-base">{icon}</span>
    {children}
  </Link>
);

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
  const { officer, logout } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [formData, setFormData] = useState(defaultForm);
  const [returningRider, setReturningRider] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [apiOnline, setApiOnline] = useState(null);
  const { addApplication } = useLoanContext();

  // API health check
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/health`)
      .then((r) => r.json())
      .then(() => setApiOnline(true))
      .catch(() => setApiOnline(false));
  }, []);

  // ── RETURNING RIDER DETECTION ──────────────────────────────────────────
  useEffect(() => {
    const check = async () => {
      const nationalId = formData.national_id.trim();
      if (nationalId.length >= 6) {
        const existingRider = getRiderByID(nationalId);
        if (existingRider) {
          const allLoans = getAllLoans();
          const riderLoans = allLoans.filter(
            (l) => l.national_id === nationalId || l.rider_id?.includes(nationalId)
          );
          setReturningRider({ profile: existingRider, loanCount: riderLoans.length, previousLoans: riderLoans });
          setFormData((prev) => ({
            ...prev,
            full_name:               existingRider.full_name               || prev.full_name,
            phone_number:            existingRider.phone_number            || prev.phone_number,
            rider_segment:           existingRider.rider_segment           || prev.rider_segment,
            bike_ownership:          existingRider.bike_ownership          || prev.bike_ownership,
            total_loans_taken:       String((existingRider.total_loans_taken || 0) + 1),
            on_time_repayment_rate:  String(existingRider.on_time_repayment_rate || "0.75"),
            ever_defaulted:          String(existingRider.ever_defaulted || "0"),
            active_digital_loans:    String(existingRider.active_digital_loans || "0"),
            is_sacco_member:         String(existingRider.is_sacco_member || "0"),
            sacco_tenure_months:     String(existingRider.sacco_tenure_months || "0"),
            sacco_contribution_rate: String(existingRider.sacco_contribution_rate || "0"),
          }));
        } else {
          setReturningRider(null);
        }
      } else {
        setReturningRider(null);
      }
    };
    const t = setTimeout(check, 500);
    return () => clearTimeout(t);
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
        updated.sacco_tenure_months = "0";
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
    if (!formData.full_name.trim()) { setError("Please enter the rider's full name."); return; }
    if (!formData.avg_daily_income || parseFloat(formData.avg_daily_income) <= 0) { setError("Please enter a valid average daily income."); return; }
    if (!formData.requested_amount || parseFloat(formData.requested_amount) <= 0) { setError("Please enter a valid requested loan amount."); return; }

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

      const response = await fetch(`${API_URL}/score`, {
  method:  "POST",
  headers: { "Content-Type": "application/json" },
  body:    JSON.stringify(payload),
  credentials: "include", // cookie sent automatically
});

      const data = await response.json();

      if (!response.ok) {
        const msg = Array.isArray(data.detail)
          ? data.detail.map((e) => `${e.loc?.slice(-1)[0] ?? "field"}: ${e.msg}`).join("\n")
          : data.detail ?? "Scoring failed. Check FastAPI server.";
        setError(msg);
      } else {
        addApplication({
          applied_at:              new Date().toISOString(),
          national_id:             formData.national_id,
          rider_name:              payload.rider_name,
          rider_id:                payload.rider_id,
          phone_number:            payload.phone_number,
          rider_segment:           payload.rider_segment,
          bike_ownership:          payload.bike_ownership,
          requested_amount:        payload.requested_amount,
          requested_term_days:     payload.requested_term_days,
          avg_daily_income:        payload.avg_daily_income,
          decision:                data.decision,
          pd_score:                data.scoring?.pd_score,
          recommended_amount:      data.recommendation?.recommended_amount,
          daily_repayment:         data.recommendation?.daily_repayment,
          scoring:                 data.scoring,
          recommendation:          data.recommendation,
          fairness:                data.fairness,
          is_sacco_member:         payload.is_sacco_member,
          sacco_tenure_months:     payload.sacco_tenure_months,
          sacco_contribution_rate: payload.sacco_contribution_rate,
          total_loans_taken:       payload.total_loans_taken,
          on_time_repayment_rate:  payload.on_time_repayment_rate,
          ever_defaulted:          payload.ever_defaulted,
          active_digital_loans:    payload.active_digital_loans,
          is_returning_rider:      !!returningRider,
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

  // ── Input / Select shared styles ───────────────────────────────────────
  const inputCls =
    "w-full border border-gray-300 p-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#235347]";

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <ErrorBoundary>
      <div
        className="flex flex-col h-screen overflow-hidden text-gray-900"
        style={{ backgroundColor: "#f4f6f4", fontFamily: "'Inter', system-ui, sans-serif" }}>

        {/* ── MOBILE HEADER ───────────────────────────────────────────── */}
        <div
          className="md:hidden flex items-center justify-between px-4 py-3 text-white flex-shrink-0"
          style={{ backgroundColor: "#111b18" }}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-white text-xl mr-2 p-1"
              aria-label="Open menu">
              ☰
            </button>
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white text-xs"
              style={{ backgroundColor: "#235347" }}>
              B
            </div>
            <p className="text-white font-bold text-sm">BodaCredit</p>
          </div>
          <span className="text-xs text-gray-400">Step {step} of 5</span>
        </div>

        {/* ── BODY ROW ────────────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden">

          {/* MOBILE OVERLAY */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-20 md:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* ── SIDEBAR ─────────────────────────────────────────────── */}
          <aside
            className={`fixed md:relative inset-y-0 left-0 z-30
                        w-60 flex flex-col flex-shrink-0 border-r border-white/10
                        transition-transform duration-300 ease-in-out
                        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
                        md:translate-x-0`}
            style={{ backgroundColor: "#111b18" }}>

            {/* LOGO */}
            <div className="px-5 py-5 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
                  style={{ backgroundColor: "#235347" }}>
                  B
                </div>
                <div className="flex-1">
                  <p className="text-white font-bold text-sm leading-none">BodaCredit</p>
                  <p className="text-gray-500 text-xs mt-0.5">Underwriting System</p>
                </div>
                <button
                  className="md:hidden text-gray-400 hover:text-white p-1 -mr-1 flex-shrink-0"
                  onClick={() => setSidebarOpen(false)}
                  aria-label="Close sidebar">
                  ✕
                </button>
              </div>
            </div>

            {/* NAV */}
            <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
              <p className="text-gray-600 text-[10px] uppercase tracking-widest px-3 mb-2">
                Main
              </p>
              <NavItem to="/dashboard"        icon="⊞" onClick={() => setSidebarOpen(false)}>Dashboard</NavItem>
              <NavItem to="/new-application"  active icon="＋" onClick={() => setSidebarOpen(false)}>New Application</NavItem>
              <NavItem to="/loan-queue"       icon="☰" onClick={() => setSidebarOpen(false)}>Loan Queue</NavItem>
              <NavItem to="/portfolio"        icon="◫" onClick={() => setSidebarOpen(false)}>Portfolio</NavItem>

              <p className="text-gray-600 text-[10px] uppercase tracking-widest px-3 mb-2 mt-5">
                Analysis
              </p>
              <NavItem to="/dashboard" icon="⚑" onClick={() => setSidebarOpen(false)}>Risk Review</NavItem>
              <NavItem to="/dashboard" icon="✓" onClick={() => setSidebarOpen(false)}>Fairness Logs</NavItem>

              {/* STEP PROGRESS in sidebar */}
              <div className="mt-6 px-3">
                <p className="text-gray-600 text-[10px] uppercase tracking-widest mb-3">
                  Application Steps
                </p>
                <div className="space-y-2">
                  {STEP_LABELS.map((label, i) => (
                    <div key={label} className="flex items-center gap-2.5">
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{
                          backgroundColor:
                            step > i + 1 ? "#22c55e"
                            : step === i + 1 ? "#235347"
                            : "#374151",
                          color: "white",
                        }}>
                        {step > i + 1 ? "✓" : i + 1}
                      </span>
                      <span
                        className={`text-xs ${
                          step === i + 1
                            ? "text-white font-semibold"
                            : step > i + 1
                            ? "text-green-400"
                            : "text-gray-500"
                        }`}>
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </nav>

            {/* API STATUS + USER + LOGOUT */}
            <div className="px-4 py-4 border-t border-white/10 space-y-3">
              <div className="flex items-center gap-2 text-xs">
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    apiOnline === null ? "bg-yellow-400 animate-pulse"
                    : apiOnline ? "bg-emerald-400"
                    : "bg-red-400"
                  }`}
                />
                <span className="text-gray-400">
                  {apiOnline === null ? "Connecting..."
                   : apiOnline ? "Scoring engine online"
                   : "Engine offline"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: "#235347" }}>
                  {officer?.name?.charAt(0).toUpperCase() ?? "L"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-medium truncate">
                    {officer?.name ?? "Loan Officer"}
                  </p>
                  <p className="text-gray-500 text-[10px]">
                    {officer?.sacco_id ?? "SACCO Admin"}
                  </p>
                </div>
              </div>

              <button
                onClick={() => { logout(); navigate("/"); }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg
                           text-gray-400 hover:text-white hover:bg-red-900/30
                           transition-all duration-150 text-xs font-medium
                           border border-white/5 hover:border-red-900/50">
                <span>⎋</span>
                Sign Out
              </button>
            </div>
          </aside>

          {/* ── MAIN CONTENT ────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* TOP BAR */}
            <header className="flex items-center justify-between px-7 py-4 bg-white border-b border-gray-100 flex-shrink-0">
              <div>
                <h1 className="text-xl font-bold text-gray-900">New Application</h1>
                <p className="text-xs text-gray-400 mt-0.5">
                  Step {step} of 5 — {STEP_LABELS[step - 1]}
                </p>
              </div>
              <Link
                to="/dashboard"
                className="text-xs px-4 py-2 rounded-lg border border-gray-200
                           text-gray-600 hover:bg-gray-50 hover:border-[#235347] transition-colors">
                ← Back to Dashboard
              </Link>
            </header>

            {/* SCROLLABLE BODY */}
            <div className="flex-1 overflow-y-auto px-4 md:px-7 py-6">

              {/* PROGRESS BAR */}
              <div className="w-full bg-gray-200 h-1.5 rounded-full mb-6 max-w-3xl">
                <div
                  className="h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${(step / 5) * 100}%`, backgroundColor: "#235347" }}
                />
              </div>

              {/* FORM CARD */}
              <div className="bg-white border border-gray-100 rounded-xl p-6 max-w-3xl shadow-sm">

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
                            Last loan:{" "}
                            {new Date(returningRider.previousLoans[0]?.applied_at).toLocaleDateString("en-KE", {
                              day: "numeric", month: "short", year: "numeric",
                            })}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => setReturningRider(null)}
                        className="text-blue-600 hover:text-blue-800 text-sm">
                        Clear
                      </button>
                    </div>
                  </div>
                )}

                {/* ── STEP 1: RIDER IDENTITY ─────────────────────────── */}
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
                          className={inputCls}
                        />
                        <p className="text-xs text-gray-400 mt-1">
                          System will auto-detect returning riders and pre-fill their information.
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
                          className={inputCls}
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
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Rider Segment
                        </label>
                        <select name="rider_segment" value={formData.rider_segment} onChange={handleChange} className={inputCls}>
                          {["Stage Rider","App Rider","Hybrid Rider","SACCO Member","Owner Rider"].map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-400 mt-1">
                          Stage = no app. App = Bolt/Little/SafeBoda. Hybrid = both.
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Bike Ownership
                        </label>
                        <select name="bike_ownership" value={formData.bike_ownership} onChange={handleChange} className={inputCls}>
                          <option value="Hired">Hired — pays daily fee</option>
                          <option value="Owned">Owned — no hire fee</option>
                        </select>
                      </div>
                    </div>
                  </>
                )}

                {/* ── STEP 2: LOAN REQUEST ───────────────────────────── */}
                {step === 2 && (
                  <>
                    <h3 className="text-lg font-semibold mb-1">Loan Request</h3>
                    <p className="text-sm text-gray-500 mb-5">What the rider is applying for.</p>
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
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Loan Term
                        </label>
                        <select name="requested_term_days" value={formData.requested_term_days} onChange={handleChange} className={inputCls}>
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
                        <select name="loan_purpose" value={formData.loan_purpose} onChange={handleChange} className={inputCls}>
                          {["Bike Repair","Working Capital","Bike Upgrade","Emergency","Bike Purchase"].map((p) => (
                            <option key={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Application Month
                        </label>
                        <select name="application_month" value={formData.application_month} onChange={handleChange} className={inputCls}>
                          {["January","February","March","April","May","June",
                            "July","August","September","October","November","December"].map((m, i) => (
                            <option key={m} value={i + 1}>{m}</option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-400 mt-1">
                          March–May and Oct–Nov are rain season — income dips not penalised.
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {/* ── STEP 3: INCOME ────────────────────────────────── */}
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
                          className={inputCls}
                        />
                        <p className="text-xs text-gray-400 mt-1">
                          Total M-Pesa income inflows ÷ active working days over last 90 days.
                        </p>
                      </div>
                      {formData.avg_daily_income && (
                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2 text-sm">
                          <p className="font-medium text-gray-700 mb-3">Auto-calculated from daily income:</p>
                          {(() => {
                            const daily   = parseFloat(formData.avg_daily_income);
                            const monthly = daily * 26;
                            const fuel    = monthly * 0.30;
                            const hire    = formData.bike_ownership === "Hired" ? 12000 : 0;
                            const ndi     = Math.max(monthly - fuel - hire - 3000 - 2000, 1000);
                            return (
                              <>
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Monthly income estimate</span>
                                  <span className="font-semibold">KES {monthly.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Fuel spend (30%)</span>
                                  <span className="font-semibold text-red-600">− KES {fuel.toLocaleString()}</span>
                                </div>
                                {hire > 0 && (
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Hire fee (hired rider)</span>
                                    <span className="font-semibold text-red-600">− KES {hire.toLocaleString()}</span>
                                  </div>
                                )}
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Food + remittances (est.)</span>
                                  <span className="font-semibold text-red-600">− KES 5,000</span>
                                </div>
                                <div className="flex justify-between border-t pt-2 mt-2">
                                  <span className="font-semibold text-gray-800">Net Disposable Income</span>
                                  <span className={`font-bold ${ndi >= 8000 ? "text-green-700" : ndi >= 4000 ? "text-yellow-700" : "text-red-700"}`}>
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

                {/* ── STEP 4: SACCO & LOAN HISTORY ──────────────────── */}
                {step === 4 && (
                  <>
                    <h3 className="text-lg font-semibold mb-1">SACCO & Loan History</h3>
                    <p className="text-sm text-gray-500 mb-5">From SACCO records and credit history.</p>
                    <div className="space-y-5">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Is this rider a SACCO member?
                          </label>
                          <div className="flex gap-3">
                            {["0","1"].map((val) => (
                              <button
                                key={val}
                                type="button"
                                onClick={() => handleChange({ target: { name: "is_sacco_member", value: val } })}
                                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition ${
                                  formData.is_sacco_member === val
                                    ? "text-white border-[#235347]"
                                    : "border-gray-300 text-gray-600 hover:bg-gray-50"
                                }`}
                                style={formData.is_sacco_member === val ? { backgroundColor: "#235347" } : {}}>
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
                              <input name="sacco_tenure_months" type="number" placeholder="e.g. 14" value={formData.sacco_tenure_months} onChange={handleChange} className={inputCls} />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Contribution Discipline
                              </label>
                              <select name="sacco_contribution_rate" value={formData.sacco_contribution_rate} onChange={handleChange} className={inputCls}>
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
                          <input name="total_loans_taken" type="number" placeholder="0 if first time borrower" value={formData.total_loans_taken} onChange={handleChange} className={inputCls} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Active Digital Loans
                          </label>
                          <select name="active_digital_loans" value={formData.active_digital_loans} onChange={handleChange} className={inputCls}>
                            <option value="0">None</option>
                            <option value="1">1 — Fuliza or Tala</option>
                            <option value="2">2 — multiple digital loans</option>
                            <option value="3">3+ — heavily indebted</option>
                          </select>
                        </div>

                        {formData.total_loans_taken === "0" ? (
                          <div className="col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                            First time borrower — repayment rate set to neutral (0.75). Not penalised for no history.
                          </div>
                        ) : (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Repayment Track Record
                              </label>
                              <select name="on_time_repayment_rate" value={formData.on_time_repayment_rate} onChange={handleChange} className={inputCls}>
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
                                {["0","1"].map((val) => (
                                  <button
                                    key={val}
                                    type="button"
                                    onClick={() => handleChange({ target: { name: "ever_defaulted", value: val } })}
                                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition ${
                                      formData.ever_defaulted === val
                                        ? val === "1"
                                          ? "bg-red-600 text-white border-red-600"
                                          : "text-white border-green-600"
                                        : "border-gray-300 text-gray-600 hover:bg-gray-50"
                                    }`}
                                    style={formData.ever_defaulted === val && val === "0" ? { backgroundColor: "#235347" } : {}}>
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

                {/* ── STEP 5: DECISION ──────────────────────────────── */}
                {step === 5 && (
                  <>
                    {!result ? (
                      <div className="text-center py-8">
                        <div className="text-5xl mb-4">📋</div>
                        <h3 className="text-xl font-semibold mb-2">Ready to Score</h3>
                        <p className="text-gray-500 text-sm mb-6">
                          All details collected for{" "}
                          <strong>{formData.full_name || "this rider"}</strong>. Click Submit to run the credit scoring pipeline.
                        </p>
                        <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2 text-sm mb-6">
                          {[
                            ["Rider",            formData.full_name],
                            ["Segment",          formData.rider_segment],
                            ["Amount Requested", `KES ${fmt(parseFloat(formData.requested_amount || 0))}`],
                            ["Daily Income",     `KES ${fmt(parseFloat(formData.avg_daily_income || 0))}`],
                            ["Prior Loans",      formData.total_loans_taken === "0" ? "First time borrower" : formData.total_loans_taken],
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
                                  backgroundColor:
                                    result.scoring.pd_score < 0.35 ? "#057a55"
                                    : result.scoring.pd_score < 0.50 ? "#c27803"
                                    : "#e02424",
                                }}
                              />
                            </div>
                          </div>
                        )}

                        <button
                          onClick={() => { setResult(null); setStep(1); setFormData(defaultForm); setReturningRider(null); }}
                          className="w-full border border-gray-300 py-3 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
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

                {/* ── NAV BUTTONS ────────────────────────────────────── */}
                <div className="flex justify-between mt-8">
                  {/* Back button — goes to previous step, or Dashboard if on step 1 */}
                  {step === 5 && !!result ? (
                    <div /> // hide back after result shown
                  ) : step === 1 ? (
                    <button
                      onClick={() => navigate("/dashboard")}
                      className="px-5 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
                      ← Dashboard
                    </button>
                  ) : (
                    <button
                      onClick={prevStep}
                      className="px-5 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
                      ← Back
                    </button>
                  )}

                  {/* Forward buttons */}
                  {step < 4 && (
                    <button
                      onClick={nextStep}
                      className="px-6 py-2 text-white rounded-lg text-sm font-medium transition"
                      style={{ backgroundColor: "#235347" }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#1a3d32"}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#235347"}>
                      Next →
                    </button>
                  )}
                  {step === 4 && (
                    <button
                      onClick={nextStep}
                      className="px-6 py-2 text-white rounded-lg text-sm font-medium transition"
                      style={{ backgroundColor: "#235347" }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#1a3d32"}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#235347"}>
                      Review & Submit →
                    </button>
                  )}
                  {step === 5 && !result && (
                    <button
                      onClick={handleSubmit}
                      disabled={loading}
                      className="px-6 py-2 bg-black text-white rounded-lg text-sm font-medium disabled:opacity-60 hover:bg-gray-800 transition flex items-center gap-2">
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
            </div>
            {/* END SCROLL BODY */}
          </div>
          {/* END MAIN CONTENT */}

        </div>
        {/* END BODY ROW */}

      </div>
    </ErrorBoundary>
  );
}
