import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getAllLoans } from "../utils/loanStore";
import { useAuth } from "../context/AuthContext";

// ── Helpers ────────────────────────────────────────────────────────────────
const fmt = (v) =>
  (typeof v === "number" && !isNaN(v) ? v : 0).toLocaleString();

const getRiskTier = (pd) => {
  if (pd < 0.20) return "LOW";
  if (pd < 0.35) return "LOW-MEDIUM";
  if (pd < 0.50) return "MEDIUM";
  if (pd < 0.65) return "HIGH";
  return "VERY HIGH";
};

const RISK_COLOR = {
  "LOW":        { bar: "#22c55e", bg: "#dcfce7", text: "#166534" },
  "LOW-MEDIUM": { bar: "#4ade80", bg: "#dcfce7", text: "#166534" },
  "MEDIUM":     { bar: "#eab308", bg: "#fef9c3", text: "#854d0e" },
  "HIGH":       { bar: "#f97316", bg: "#ffedd5", text: "#9a3412" },
  "VERY HIGH":  { bar: "#ef4444", bg: "#fee2e2", text: "#991b1b" },
};

const getDecisionStyle = (decision = "") => {
  const d = (decision || "").toUpperCase();
  if (d === "APPROVE" || d === "APPROVED")
    return { bg: "#dcfce7", text: "#166534" };
  if (d === "DECLINE" || d === "DECLINED" || d === "HARD_BLOCK")
    return { bg: "#fee2e2", text: "#991b1b" };
  return { bg: "#fef9c3", text: "#854d0e" };
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

// ── Component ──────────────────────────────────────────────────────────────
export default function Portfolio() {
  const { officer, logout } = useAuth();
  const navigate            = useNavigate();
  const [loans,       setLoans]       = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [apiOnline,   setApiOnline]   = useState(null);
  const [segment,     setSegment]     = useState("All Segments");

  // API health check
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/health`)
      .then((r) => r.json())
      .then(() => setApiOnline(true))
      .catch(() => setApiOnline(false));
  }, []);

  useEffect(() => {
    setLoans(getAllLoans());
  }, []);

  // ── Metrics ──────────────────────────────────────────────────────────────
  const filtered = segment === "All Segments"
    ? loans
    : loans.filter((l) => l.rider_segment === segment);

  const totalDisbursed = filtered.reduce((s, l) => s + (l.requested_amount || 0), 0);
  const avgLoanSize    = filtered.length ? totalDisbursed / filtered.length : 0;
  const approvedLoans  = filtered.filter((l) => {
    const d = (l.decision || "").toUpperCase();
    return d === "APPROVE" || d === "APPROVED";
  });

  const avgRepaymentRate = filtered.length
    ? filtered.reduce((s, l) => s + (l.on_time_repayment_rate || 0.75), 0) / filtered.length
    : 0;

  const riskCounts = { LOW: 0, "LOW-MEDIUM": 0, MEDIUM: 0, HIGH: 0, "VERY HIGH": 0 };
  filtered.forEach((l) => {
    const tier = getRiskTier(l.pd_score ?? 0.5);
    riskCounts[tier]++;
  });

  const SEGMENTS = ["All Segments", "Stage Rider", "App Rider", "Hybrid Rider", "SACCO Member", "Owner Rider"];

  return (
    <div
      className="flex flex-col h-screen overflow-hidden text-gray-900"
      style={{ backgroundColor: "#f4f6f4", fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── MOBILE HEADER ───────────────────────────────────────────────── */}
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
        <Link
          to="/new-application"
          className="text-xs px-3 py-1.5 rounded-lg text-white no-underline"
          style={{ backgroundColor: "#235347" }}>
          + New
        </Link>
      </div>

      {/* ── BODY ROW ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* MOBILE OVERLAY */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-20 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ── SIDEBAR ─────────────────────────────────────────────────── */}
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
            <NavItem to="/dashboard"       icon="⊞" onClick={() => setSidebarOpen(false)}>Dashboard</NavItem>
            <NavItem to="/new-application" icon="＋" onClick={() => setSidebarOpen(false)}>New Application</NavItem>
            <NavItem to="/loan-queue"      icon="☰" onClick={() => setSidebarOpen(false)}>Loan Queue</NavItem>
            <NavItem to="/portfolio" active icon="◫" onClick={() => setSidebarOpen(false)}>Portfolio</NavItem>

            <p className="text-gray-600 text-[10px] uppercase tracking-widest px-3 mb-2 mt-5">
              Analysis
            </p>
            <NavItem to="/dashboard" icon="⚑" onClick={() => setSidebarOpen(false)}>Risk Review</NavItem>
            <NavItem to="/dashboard" icon="✓" onClick={() => setSidebarOpen(false)}>Fairness Logs</NavItem>
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

        {/* ── MAIN CONTENT ──────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* TOP BAR */}
          <header className="flex items-center justify-between px-7 py-4 bg-white border-b border-gray-100 flex-shrink-0">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Portfolio</h1>
              <p className="text-xs text-gray-400 mt-0.5">Monitor loan performance and portfolio health</p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to="/dashboard"
                className="text-xs px-4 py-2 rounded-lg border border-gray-200
                           text-gray-600 hover:bg-gray-50 hover:border-[#235347] transition-colors no-underline">
                ← Dashboard
              </Link>
              <Link
                to="/new-application"
                className="text-xs px-4 py-2.5 rounded-lg text-white font-semibold transition-all no-underline"
                style={{ backgroundColor: "#235347" }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#1a3d32"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#235347"}>
                New Application
              </Link>
            </div>
          </header>

          {/* SCROLLABLE BODY */}
          <div className="flex-1 overflow-y-auto px-4 md:px-7 py-6 space-y-6">

            {/* FILTER BAR */}
            <div className="bg-white rounded-xl border border-gray-100 px-5 py-3.5 flex flex-wrap gap-3 items-center shadow-sm">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Filter by:</p>
              {SEGMENTS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSegment(s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                    segment === s
                      ? "text-white border-[#235347]"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                  style={segment === s ? { backgroundColor: "#235347" } : {}}>
                  {s}
                </button>
              ))}
            </div>

            {/* ── KPI CARDS ─────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  label: "Approved Loans",
                  value: approvedLoans.length,
                  sub:   `of ${filtered.length} total`,
                  color: "#235347",
                },
                {
                  label: "Total Requested",
                  value: `KES ${fmt(totalDisbursed)}`,
                  sub:   `across ${filtered.length} application${filtered.length !== 1 ? "s" : ""}`,
                  color: "#166534",
                },
                {
                  label: "Avg Loan Size",
                  value: `KES ${fmt(Math.round(avgLoanSize))}`,
                  sub:   "per application",
                  color: "#235347",
                },
                {
                  label: "Avg Repayment Rate",
                  value: `${Math.round(avgRepaymentRate * 100)}%`,
                  sub:   "across scored riders",
                  color: avgRepaymentRate >= 0.80 ? "#166534" : avgRepaymentRate >= 0.60 ? "#854d0e" : "#991b1b",
                },
              ].map((k) => (
                <div
                  key={k.label}
                  className="bg-white rounded-xl p-5 border border-gray-100 hover:shadow-md transition-shadow">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wider leading-tight mb-3">
                    {k.label}
                  </p>
                  <p className="text-2xl font-bold text-gray-900">{k.value}</p>
                  <p className="text-xs text-gray-400 mt-1">{k.sub}</p>
                  <div className="mt-3 h-0.5 rounded-full" style={{ backgroundColor: k.color, opacity: 0.3 }} />
                </div>
              ))}
            </div>

            {/* ── RISK DISTRIBUTION + SEGMENT BREAKDOWN ─────────────────── */}
            <div className="grid lg:grid-cols-2 gap-4">

              {/* RISK DISTRIBUTION */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="px-5 py-4 border-b border-gray-50">
                  <h2 className="font-bold text-gray-900 text-sm">Risk Distribution</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {filtered.length} scored application{filtered.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="px-5 py-5 space-y-4">
                  {filtered.length === 0 ? (
                    <p className="text-center text-gray-400 text-sm py-6">No data yet</p>
                  ) : (
                    Object.entries(riskCounts).map(([tier, count]) => {
                      const rc  = RISK_COLOR[tier];
                      const pct = filtered.length ? Math.round((count / filtered.length) * 100) : 0;
                      return (
                        <div key={tier}>
                          <div className="flex justify-between text-xs mb-1.5">
                            <span
                              className="font-medium px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: rc.bg, color: rc.text }}>
                              {tier}
                            </span>
                            <span className="text-gray-400">{count} ({pct}%)</span>
                          </div>
                          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${pct}%`, backgroundColor: rc.bar }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* DECISION SUMMARY */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="px-5 py-4 border-b border-gray-50">
                  <h2 className="font-bold text-gray-900 text-sm">Decision Summary</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Model outcomes breakdown</p>
                </div>
                <div className="px-5 py-5 space-y-3">
                  {filtered.length === 0 ? (
                    <p className="text-center text-gray-400 text-sm py-6">No data yet</p>
                  ) : (() => {
                    const approved = filtered.filter((l) => ["APPROVE","APPROVED"].includes((l.decision || "").toUpperCase())).length;
                    const declined = filtered.filter((l) => ["DECLINE","DECLINED","HARD_BLOCK"].includes((l.decision || "").toUpperCase())).length;
                    const review   = filtered.length - approved - declined;
                    return (
                      <>
                        {[
                          { label: "Approved", count: approved, color: "#22c55e", bg: "#dcfce7", text: "#166534" },
                          { label: "In Review", count: review,   color: "#eab308", bg: "#fef9c3", text: "#854d0e" },
                          { label: "Declined",  count: declined, color: "#ef4444", bg: "#fee2e2", text: "#991b1b" },
                        ].map((s) => {
                          const pct = filtered.length ? Math.round((s.count / filtered.length) * 100) : 0;
                          return (
                            <div key={s.label}>
                              <div className="flex justify-between text-xs mb-1.5">
                                <span className="font-medium" style={{ color: s.text }}>{s.label}</span>
                                <span className="text-gray-400">{s.count} ({pct}%)</span>
                              </div>
                              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-700"
                                  style={{ width: `${pct}%`, backgroundColor: s.color }}
                                />
                              </div>
                            </div>
                          );
                        })}

                        <div className="pt-3 border-t border-gray-50 grid grid-cols-3 gap-2 text-center">
                          {[
                            { label: "Approved", val: approved, color: "#166534", bg: "#dcfce7" },
                            { label: "Review",   val: review,   color: "#854d0e", bg: "#fef9c3" },
                            { label: "Declined", val: declined, color: "#991b1b", bg: "#fee2e2" },
                          ].map((s) => (
                            <div key={s.label} className="rounded-lg py-2" style={{ backgroundColor: s.bg }}>
                              <p className="text-lg font-bold" style={{ color: s.color }}>{s.val}</p>
                              <p className="text-xs" style={{ color: s.color, opacity: 0.8 }}>{s.label}</p>
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* ── RECENT LOANS TABLE ─────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-gray-900 text-sm">Recent Loans</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Latest 10 applications</p>
                </div>
                <Link
                  to="/loan-queue"
                  className="text-xs font-medium no-underline transition-colors"
                  style={{ color: "#235347" }}>
                  View all →
                </Link>
              </div>

              {filtered.length === 0 ? (
                <div className="py-16 text-center text-gray-400">
                  <p className="text-3xl mb-3">📭</p>
                  <p className="text-sm">No loans yet</p>
                  <Link
                    to="/new-application"
                    className="mt-3 text-xs font-medium no-underline block"
                    style={{ color: "#235347" }}>
                    Score your first rider →
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left text-xs uppercase text-gray-400 border-b border-gray-100">
                      <tr>
                        <th className="px-5 py-3">Rider</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Credit Score</th>
                        <th className="px-4 py-3">Decision</th>
                        <th className="px-4 py-3">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.slice(0, 10).map((loan, i) => {
                        const score = loan.pd_score != null
                          ? Math.round((1 - loan.pd_score) * 100)
                          : null;
                        const tier = getRiskTier(loan.pd_score ?? 0.5);
                        const rc   = RISK_COLOR[tier];
                        const ds   = getDecisionStyle(loan.decision);
                        return (
                          <tr
                            key={loan.id ?? i}
                            className="border-t border-gray-100 hover:bg-gray-50/60 transition-colors">
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                                  style={{ backgroundColor: "#235347" }}>
                                  {loan.rider_name?.charAt(0).toUpperCase() ?? "?"}
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900">{loan.rider_name}</p>
                                  <p className="text-xs text-gray-400">{loan.rider_segment}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-gray-700">
                              KES {fmt(loan.requested_amount)}
                            </td>
                            <td className="px-4 py-3.5">
                              {score != null ? (
                                <span
                                  className="px-2.5 py-1 rounded-full text-xs font-medium"
                                  style={{ backgroundColor: rc.bg, color: rc.text }}>
                                  {score}/100
                                </span>
                              ) : (
                                <span className="text-gray-400 text-xs">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5">
                              <span
                                className="px-2.5 py-1 rounded-full text-xs font-semibold"
                                style={{ backgroundColor: ds.bg, color: ds.text }}>
                                {loan.decision || "PENDING"}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-gray-400 text-xs">
                              {loan.applied_at
                                ? new Date(loan.applied_at).toLocaleDateString("en-KE", {
                                    day: "numeric", month: "short", year: "numeric",
                                  })
                                : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
          {/* END SCROLLABLE BODY */}
        </div>
        {/* END MAIN CONTENT */}

      </div>
      {/* END BODY ROW */}

    </div>
  );
}
