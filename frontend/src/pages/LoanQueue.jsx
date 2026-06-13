import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLoanContext } from "../context/LoanContext";
import { useAuth } from "../context/AuthContext";

// ── Helpers ────────────────────────────────────────────────────────────────
const getRiskColor = (pd) => {
  if (!pd && pd !== 0) return "bg-gray-100 text-gray-600";
  if (pd < 0.35) return "bg-green-100 text-green-800";
  if (pd < 0.50) return "bg-yellow-100 text-yellow-800";
  if (pd < 0.65) return "bg-orange-100 text-orange-800";
  return "bg-red-100 text-red-800";
};

const getRiskLabel = (pd) => {
  if (!pd && pd !== 0) return "N/A";
  if (pd < 0.20) return "LOW";
  if (pd < 0.35) return "LOW-MED";
  if (pd < 0.50) return "MEDIUM";
  if (pd < 0.65) return "HIGH";
  return "VERY HIGH";
};

const fmt = (v) =>
  (typeof v === "number" && !isNaN(v) ? v : 0).toLocaleString();

const resolveDecision = (app) => app.officer_decision ?? app.decision ?? "—";

const getDecisionBadgeStyle = (decision) => {
  if (!decision) return "bg-gray-100 text-gray-600 border-gray-200";
  const d = decision.toUpperCase();
  if (d === "APPROVED" || d === "APPROVE")
    return "bg-emerald-50 text-emerald-800 border-emerald-200";
  if (d === "DECLINED" || d === "DECLINE" || d === "HARD_BLOCK")
    return "bg-red-50 text-red-800 border-red-200";
  return "bg-amber-50 text-amber-800 border-amber-200";
};

const decisionEmoji = (decision) => {
  if (!decision) return "";
  const d = decision.toUpperCase();
  if (d === "APPROVE" || d === "APPROVED") return "✅ ";
  if (d === "DECLINE" || d === "DECLINED" || d === "HARD_BLOCK") return "🚫 ";
  return "⚠️ ";
};

const getRowClass = (app, isSelected) => {
  const d = app.officer_decision?.toUpperCase();
  if (d === "APPROVED") {
    return `border-l-4 border-l-emerald-500 bg-emerald-50/60
            ${isSelected ? "bg-emerald-100/80" : "hover:bg-emerald-100/80"}`;
  }
  if (d === "DECLINED") {
    return `border-l-4 border-l-red-400 bg-red-50/50
            ${isSelected ? "bg-red-100/70" : "hover:bg-red-100/70"}`;
  }
  return `border-l-4 border-l-transparent
          ${isSelected
            ? "bg-gray-50 border-l-gray-400"
            : "hover:bg-gray-50 hover:border-l-gray-300"}`;
};

const getDecisionTextClass = (app) => {
  const d = resolveDecision(app).toUpperCase();
  if (d === "APPROVE" || d === "APPROVED") return "text-emerald-700 font-semibold";
  if (d === "DECLINE" || d === "DECLINED" || d === "HARD_BLOCK")
    return "text-red-600 font-semibold";
  return "text-amber-700 font-semibold";
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
export default function LoanQueue() {
  const { applications, updateStatus } = useLoanContext();
  const { officer, logout }            = useAuth();
  const navigate                       = useNavigate();
  const [selected,    setSelected]     = useState(null);
  const [filter,      setFilter]       = useState("ALL");
  const [sidebarOpen, setSidebarOpen]  = useState(false);
  const [apiOnline,   setApiOnline]    = useState(null);

  // API health check
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/health`)
      .then((r) => r.json())
      .then(() => setApiOnline(true))
      .catch(() => setApiOnline(false));
  }, []);

  const selectedApp = selected
    ? applications.find((a) => a.id === selected.id) ?? selected
    : null;

  const filtered = filter === "ALL"
    ? applications
    : applications.filter((a) => {
        const active = resolveDecision(a).toUpperCase();
        if (filter === "APPROVED")
          return active === "APPROVE" || active === "APPROVED";
        if (filter === "DECLINED")
          return active === "DECLINE" || active === "DECLINED" || active === "HARD_BLOCK";
        return (
          !a.officer_decision &&
          active !== "APPROVE" && active !== "APPROVED" &&
          active !== "DECLINE" && active !== "DECLINED" && active !== "HARD_BLOCK"
        );
      });

  const handleOverride = (officerDecision) => {
    if (!selectedApp) return;
    updateStatus(selectedApp.id, officerDecision);
  };

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
           New
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
            <NavItem to="/loan-queue" active icon="☰" onClick={() => setSidebarOpen(false)}>Loan Queue</NavItem>
            <NavItem to="/portfolio"       icon="◫" onClick={() => setSidebarOpen(false)}>Portfolio</NavItem>

            <p className="text-gray-600 text-[10px] uppercase tracking-widest px-3 mb-2 mt-5">
              Analysis
            </p>
            <NavItem to="/dashboard" icon="⚑" onClick={() => setSidebarOpen(false)}>Risk Review</NavItem>
            <NavItem to="/dashboard" icon="✓" onClick={() => setSidebarOpen(false)}>Fairness Logs</NavItem>

            {/* Row colour legend */}
            <div className="mt-6 px-3">
              <p className="text-gray-600 text-[10px] uppercase tracking-widest mb-3">
                Row Key
              </p>
              <div className="space-y-2 text-xs text-gray-500">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm bg-emerald-400 flex-shrink-0" />
                  Officer Approved
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm bg-red-400 flex-shrink-0" />
                  Officer Declined
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm bg-gray-600 flex-shrink-0" />
                  Awaiting review
                </div>
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

        {/* ── MAIN CONTENT ──────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* TOP BAR */}
          <header className="flex items-center justify-between px-7 py-4 bg-white border-b border-gray-100 flex-shrink-0">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Loan Queue</h1>
              <p className="text-xs text-gray-400 mt-0.5">
                {applications.length} application{applications.length !== 1 ? "s" : ""} submitted
              </p>
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
                className="text-xs px-4 py-2.5 rounded-lg text-white font-semibold
                           transition-all no-underline"
                style={{ backgroundColor: "#235347" }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#1a3d32"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#235347"}>
                New Application
              </Link>
            </div>
          </header>

          {/* ── TABLE + INSPECTOR ROW ──────────────────────────────────── */}
          <div className="flex-1 flex overflow-hidden">

            {/* LEFT — TABLE */}
            <section className="flex-1 overflow-y-auto px-4 md:px-7 py-6">

              {/* FILTER TABS */}
              <div className="flex gap-2 mb-5">
                {["ALL", "APPROVED", "DECLINED", "PENDING"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-4 py-1.5 rounded-full text-xs font-medium border transition ${
                      filter === f
                        ? "text-white border-[#235347]"
                        : "border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}
                    style={filter === f ? { backgroundColor: "#235347" } : {}}>
                    {f}
                  </button>
                ))}
              </div>

              {/* TABLE */}
              {filtered.length === 0 ? (
                <div className="bg-white border border-gray-100 rounded-xl p-16 text-center text-gray-400 shadow-sm">
                  <div className="text-5xl mb-4"></div>
                  <p className="font-medium">No applications here</p>
                  <p className="text-sm mt-1">
                    {filter === "ALL"
                      ? "Submit a new application to see it here"
                      : `No ${filter.toLowerCase()} applications yet`}
                  </p>
                </div>
              ) : (
                <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left text-xs uppercase text-gray-400 border-b border-gray-100">
                      <tr>
                        <th className="px-4 py-3 pl-5">Rider</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Risk</th>
                        <th className="px-4 py-3">Decision</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Daily Payment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((app) => {
                        const activeDecision = resolveDecision(app);
                        const hasOverride    = !!app.officer_decision;
                        const isSelected     = selectedApp?.id === app.id;

                        return (
                          <tr
                            key={app.id}
                            onClick={() => setSelected(app)}
                            className={`border-t border-gray-100 cursor-pointer
                                        transition-all duration-150
                                        ${getRowClass(app, isSelected)}`}>
                            <td className="px-4 py-3 pl-5">
                              <p className="font-medium text-gray-900">{app.rider_name}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{app.rider_segment}</p>
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                              KES {fmt(app.requested_amount)}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRiskColor(app.pd_score)}`}>
                                {getRiskLabel(app.pd_score)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-0.5">
                                <span className={`text-xs ${getDecisionTextClass(app)}`}>
                                  {decisionEmoji(activeDecision)}{activeDecision}
                                </span>
                                {hasOverride && (
                                  <span className="text-[10px] text-gray-400">
                                    ML: {app.decision}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-400 text-xs">
                              {new Date(app.submitted_at ?? app.applied_at).toLocaleDateString("en-KE", {
                                day: "numeric", month: "short", year: "numeric",
                              })}
                            </td>
                            <td className="px-4 py-3 font-medium" style={{ color: "#235347" }}>
                              KES {fmt(app.daily_repayment)}/day
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* RIGHT — INSPECTOR PANEL */}
            <aside className="hidden md:flex w-96 bg-white border-l border-gray-100 flex-col flex-shrink-0 overflow-y-auto">
              {!selectedApp ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <div className="text-4xl mb-3"></div>
                  <p className="text-sm">Select a row to inspect</p>
                </div>
              ) : (
                <div className="p-6 space-y-5 text-sm">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {selectedApp.rider_name}
                    </h3>
                    <p className="text-gray-400 text-xs mt-0.5">
                      {selectedApp.national_id ? `ID: ${selectedApp.national_id} · ` : ""}
                      {selectedApp.rider_segment}
                    </p>
                  </div>

                  {/* Decision badge */}
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1.5">
                      {selectedApp.officer_decision ? "Officer Decision" : "Model Decision"}
                    </p>
                    <div className={`rounded-lg px-4 py-3 border text-sm font-semibold
                                    ${getDecisionBadgeStyle(resolveDecision(selectedApp))}`}>
                      {decisionEmoji(resolveDecision(selectedApp))}
                      {resolveDecision(selectedApp)}
                    </div>
                    {selectedApp.officer_decision && (
                      <p className="text-xs text-gray-400 mt-1.5 pl-1">
                        Model recommended: {selectedApp.decision}
                      </p>
                    )}
                  </div>

                  {/* Key numbers */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ["Requested",    `KES ${fmt(selectedApp.requested_amount)}`],
                      ["Approved",     `KES ${fmt(selectedApp.recommendation?.recommended_amount ?? selectedApp.recommended_amount)}`],
                      ["Term",         `${selectedApp.requested_term_days ?? "—"} days`],
                      ["Daily Income", `KES ${fmt(selectedApp.avg_daily_income)}`],
                      ["Daily Repay",  `KES ${fmt(selectedApp.recommendation?.daily_repayment ?? selectedApp.daily_repayment)}`],
                      ["PD Score",     selectedApp.pd_score != null
                                         ? `${(selectedApp.pd_score * 100).toFixed(1)}%`
                                         : "—"],
                    ].map(([label, val]) => (
                      <div key={label} className="bg-gray-50 rounded-lg p-3">
                        <p className="text-gray-400 text-xs">{label}</p>
                        <p className="font-semibold mt-0.5 text-gray-800">{val}</p>
                      </div>
                    ))}
                  </div>

                  {/* Fairness warnings */}
                  {selectedApp.fairness?.warnings?.length > 0 && (
                    <div className="space-y-1">
                      {selectedApp.fairness.warnings.map((w, i) => (
                        <div key={i} className="text-xs text-amber-700 flex gap-2">
                          <span></span>
                          <span>{w.check} — {w.detail}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Override buttons */}
                  <div className="border-t border-gray-100 pt-4">
                    <p className="text-xs text-gray-400 mb-2.5 uppercase tracking-wide">
                      Officer Override
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOverride("APPROVED")}
                        disabled={selectedApp.officer_decision === "APPROVED"}
                        className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition border ${
                          selectedApp.officer_decision === "APPROVED"
                            ? "bg-emerald-600 text-white border-emerald-600 cursor-default"
                            : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                        }`}>
                         Approve
                      </button>
                      <button
                        onClick={() => handleOverride("DECLINED")}
                        disabled={selectedApp.officer_decision === "DECLINED"}
                        className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition border ${
                          selectedApp.officer_decision === "DECLINED"
                            ? "bg-red-600 text-white border-red-600 cursor-default"
                            : "border-red-300 text-red-700 hover:bg-red-50"
                        }`}>
                         Decline
                      </button>
                    </div>

                    {selectedApp.officer_decision && (
                      <button
                        onClick={() => handleOverride(null)}
                        className="w-full mt-2 py-1.5 rounded-lg border border-gray-200
                                   text-xs text-gray-500 hover:bg-gray-50 transition">
                        ↩ Revert to model decision
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-gray-300 text-center pt-1">
                    Submitted{" "}
                    {new Date(selectedApp.submitted_at ?? selectedApp.applied_at).toLocaleString("en-KE")}
                  </p>
                </div>
              )}
            </aside>

          </div>
          {/* END TABLE + INSPECTOR */}

        </div>
        {/* END MAIN CONTENT */}

      </div>
      {/* END BODY ROW */}

    </div>
  );
}
