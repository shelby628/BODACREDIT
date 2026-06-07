import { useState } from "react";
import { Link } from "react-router-dom";
import { useLoanContext } from "../context/LoanContext";

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

// ── The key design decision:
// Approved  → very faint green tint + solid green left border
// Declined  → very faint red tint  + solid red left border
// Pending   → white, no tint
// Hover     → slightly deeper tint + left border appears
// Selected  → same as hover but persists
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
  // No officer decision
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

export default function LoanQueue() {
  const { applications, updateStatus } = useLoanContext();
  const [selected, setSelected]        = useState(null);
  const [filter,   setFilter]          = useState("ALL");

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
    <div className="min-h-screen flex bg-[#f4f6f4] text-gray-900">

      {/* SIDEBAR */}
      <aside className="w-64 bg-[#111827] text-white p-5 flex-shrink-0 flex flex-col">
        <h1 className="text-2xl font-bold text-[#235347]">BodaCredit</h1>
        <div className="mt-10 space-y-2 text-sm">
          <div className="px-3 py-2 rounded bg-[#235347] font-medium">Loan Queue</div>
          <Link to="/new-application"
            className="block px-3 py-2 rounded hover:bg-gray-800 text-white no-underline">
            New Application
          </Link>
        </div>

        {/* Legend — helps officers understand row colours at a glance */}
        <div className="mt-10 space-y-2 text-xs text-gray-500">
          <p className="uppercase tracking-widest text-[10px] text-gray-600 mb-3">
            Row Key
          </p>
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

        {/* BACK BUTTON — pinned to bottom */}
        <div className="mt-auto pt-6 border-t border-gray-700">
          <button
            onClick={() => window.history.back()}
            className="w-full flex items-center gap-2 px-3 py-2 rounded
                       hover:bg-gray-800 text-white transition text-sm"
          >
            ← Back
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 flex overflow-hidden">

        {/* LEFT — TABLE */}
        <section className="flex-1 p-8 overflow-y-auto">

          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold">Loan Queue</h2>
              <p className="text-gray-500 mt-1">
                {applications.length} application{applications.length !== 1 ? "s" : ""} submitted
              </p>
            </div>
            <Link to="/new-application"
              className="px-4 py-2 bg-[#235347] text-white rounded-lg text-sm
                         font-medium hover:bg-green-900 transition no-underline">
               New Application
            </Link>
          </div>

          {/* FILTER TABS */}
          <div className="flex gap-2 mb-5">
            {["ALL", "APPROVED", "DECLINED", "PENDING"].map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium border transition ${
                  filter === f
                    ? "bg-[#235347] text-white border-[#235347]"
                    : "border-gray-300 text-gray-600 hover:bg-gray-50"
                }`}>
                {f}
              </button>
            ))}
          </div>

          {/* TABLE */}
          {filtered.length === 0 ? (
            <div className="bg-white border rounded-xl p-16 text-center text-gray-400">
              <div className="text-5xl mb-4">📭</div>
              <p className="font-medium">No applications here</p>
              <p className="text-sm mt-1">
                {filter === "ALL"
                  ? "Submit a new application to see it here"
                  : `No ${filter.toLowerCase()} applications yet`}
              </p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase
                                  text-gray-400 border-b border-gray-100">
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
                                    ${getRowClass(app, isSelected)}`}
                      >
                        <td className="px-4 py-3 pl-5">
                          <p className="font-medium text-gray-900">{app.rider_name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{app.rider_segment}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          KES {fmt(app.requested_amount)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium
                                           ${getRiskColor(app.pd_score)}`}>
                            {getRiskLabel(app.pd_score)}
                          </span>
                        </td>

                        {/* Decision column */}
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className={`text-xs ${getDecisionTextClass(app)}`}>
                              {decisionEmoji(activeDecision)}{activeDecision}
                            </span>
                            {/* Show ML decision subtly if officer has overridden */}
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
                        <td className="px-4 py-3 text-[#235347] font-medium">
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
        <aside className="w-96 bg-white border-l border-gray-100 p-6
                          overflow-y-auto flex-shrink-0">
          {!selectedApp ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <div className="text-4xl mb-3">👆</div>
              <p className="text-sm">Select a row to inspect</p>
            </div>
          ) : (
            <div className="space-y-5 text-sm">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {selectedApp.rider_name}
                </h3>
                <p className="text-gray-400 text-xs mt-0.5">
                  {selectedApp.national_id
                    ? `ID: ${selectedApp.national_id} · `
                    : ""}
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
                      <span>⚠️</span>
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
                    className={`flex-1 py-2.5 rounded-lg text-xs font-semibold
                                transition border
                      ${selectedApp.officer_decision === "APPROVED"
                        ? "bg-emerald-600 text-white border-emerald-600 cursor-default"
                        : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"}`}>
                    ✅ Approve
                  </button>
                  <button
                    onClick={() => handleOverride("DECLINED")}
                    disabled={selectedApp.officer_decision === "DECLINED"}
                    className={`flex-1 py-2.5 rounded-lg text-xs font-semibold
                                transition border
                      ${selectedApp.officer_decision === "DECLINED"
                        ? "bg-red-600 text-white border-red-600 cursor-default"
                        : "border-red-300 text-red-700 hover:bg-red-50"}`}>
                    🚫 Decline
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
                {new Date(
                  selectedApp.submitted_at ?? selectedApp.applied_at
                ).toLocaleString("en-KE")}
              </p>
            </div>
          )}
        </aside>

      </main>
    </div>
  );
}

