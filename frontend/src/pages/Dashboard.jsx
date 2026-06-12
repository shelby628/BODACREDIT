import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getAllLoans, getAllRiders } from "../utils/loanStore";
import { useAuth } from "../context/AuthContext";
// ── Helpers ────────────────────────────────────────────────────────────────
const fmt = (v) => (typeof v === "number" && !isNaN(v) ? v : 0).toLocaleString();

const getRiskTier = (pd) =>
  pd < 0.20 ? "LOW"
  : pd < 0.35 ? "LOW-MEDIUM"
  : pd < 0.50 ? "MEDIUM"
  : pd < 0.65 ? "HIGH"
  : "VERY HIGH";

const RISK_COLOR = {
  "LOW":        { bg: "#dcfce7", text: "#166534", dot: "#22c55e" },
  "LOW-MEDIUM": { bg: "#dcfce7", text: "#102476", dot: "#22c55e" },
  "MEDIUM":     { bg: "#fef9c3", text: "#854d0e", dot: "#13685e" },
  "HIGH":       { bg: "#ffedd5", text: "#9a3412", dot: "#1a5338" },
  "VERY HIGH":  { bg: "#fee2e2", text: "#991b1b", dot: "#ef4444" },
};

const DECISION_COLOR = {
  APPROVE:   { bg: "#dcfce7", text: "#166534" },
  APPROVED:  { bg: "#dcfce7", text: "#166534" },
  DECLINE:   { bg: "#fee2e2", text: "#991b1b" },
  DECLINED:  { bg: "#fee2e2", text: "#991b1b" },
  HARD_BLOCK:{ bg: "#fee2e2", text: "#991b1b" },
};

const decisionColor = (d = "") =>
  DECISION_COLOR[d.toUpperCase()] ?? { bg: "#fef9c3", text: "#854d0e" };

const decisionEmoji = (d = "") => {
  const u = d.toUpperCase();
  if (u === "APPROVE" || u === "APPROVED") return "✅";
  if (u === "DECLINE" || u === "DECLINED" || u === "HARD_BLOCK") return "🚫";
  return "⚠️";
};

// Animated counter
function AnimCounter({ target, prefix = "", suffix = "" }) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  const [started, setStarted] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setStarted(true); },
      { threshold: 0.3 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  useEffect(() => {
    if (!started) return;
    const n = parseFloat(target);
    const isFloat = String(target).includes(".");
    let i = 0; const steps = 40;
    const t = setInterval(() => {
      i++;
      const p = 1 - Math.pow(1 - i / steps, 3);
      setVal(isFloat ? parseFloat((p * n).toFixed(2)) : Math.floor(p * n));
      if (i >= steps) clearInterval(t);
    }, 1000 / steps);
    return () => clearInterval(t);
  }, [started, target]);
  return <span ref={ref}>{prefix}{val}{suffix}</span>;
}

// Sidebar nav item
const NavItem = ({ to, active, icon, children }) => (
  <Link to={to}
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

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────
export default function Dashboard() {
  const { officer, logout } = useAuth();
  const navigate   = useNavigate();
  const [loans,    setLoans]    = useState([]);
  const [riders,   setRiders]   = useState({});
  const [apiOnline, setApiOnline] = useState(null);
  const [now,      setNow]      = useState(new Date());

  // live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  // API health check
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/health`)
      .then((r) => r.json())
      .then(() => setApiOnline(true))
      .catch(() => setApiOnline(false));
  }, []);

  // Load from store
  // ✅ FIXED — refreshes on mount AND every time you return to this page
useEffect(() => {
  const refresh = () => {
    setLoans(getAllLoans());
    setRiders(getAllRiders());
  };

  refresh(); // load immediately on mount

  // Re-run when user navigates back to this tab/page
  window.addEventListener("focus", refresh);
  document.addEventListener("visibilitychange", refresh);

  return () => {
    window.removeEventListener("focus", refresh);
    document.removeEventListener("visibilitychange", refresh);
  };
}, []);
  // ── Derived stats ────────────────────────────────────────────────────────
  const today     = new Date().toDateString();
  const todayLoans = loans.filter((l) => new Date(l.applied_at).toDateString() === today);

  const totalApproved = loans.filter((l) =>
    ["APPROVE","APPROVED"].includes(l.decision?.toUpperCase())).length;
  const totalDeclined = loans.filter((l) =>
    ["DECLINE","DECLINED","HARD_BLOCK"].includes(l.decision?.toUpperCase())).length;
  const totalReview   = loans.filter((l) =>
    l.decision?.toUpperCase().includes("REVIEW")).length;

  const approvedAmount = loans
    .filter((l) => ["APPROVE","APPROVED"].includes(l.decision?.toUpperCase()))
    .reduce((sum, l) => sum + (l.recommendation?.recommended_amount ?? 0), 0);

  const avgScore = loans.length
    ? Math.round(
        loans.reduce((s, l) => s + (l.scoring?.pd_score != null
          ? (1 - l.scoring.pd_score) * 100 : 0), 0) / loans.length
      )
    : 0;

  const returningCount = loans.filter((l) => l.is_returning_rider).length;
  const riderCount     = Object.keys(riders).length;

  // Risk distribution
  const riskCounts = { LOW: 0, "LOW-MEDIUM": 0, MEDIUM: 0, HIGH: 0, "VERY HIGH": 0 };
  loans.forEach((l) => {
    if (l.scoring?.pd_score != null) {
      const t = getRiskTier(l.scoring.pd_score);
      riskCounts[t] = (riskCounts[t] || 0) + 1;
    }
  });

  // Monthly volume — last 6 months
  const monthlyData = (() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const label = d.toLocaleString("default", { month: "short" });
      const count = loans.filter((l) => {
        const ld = new Date(l.applied_at);
        return `${ld.getFullYear()}-${ld.getMonth()}` === key;
      }).length;
      months.push({ label, count });
    }
    return months;
  })();
  const maxMonthly = Math.max(...monthlyData.map((m) => m.count), 1);

  // Recent 8 for activity feed
  const recent = loans.slice(0, 8);

  // Recent 5 for queue preview
  const queuePreview = loans.slice(0, 5);

  return (
    <div className="flex h-screen overflow-hidden text-gray-900"
      style={{ backgroundColor: "#f4f6f4", fontFamily: "'Inter', system-ui, sans-serif" }}>

            {/* ── SIDEBAR ───────────────────────────────────────────────────── */}
      <aside className="w-60 flex flex-col flex-shrink-0 border-r border-white/10"
        style={{ backgroundColor: "#111b18" }}>

        {/* LOGO */}
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold
                            text-white text-sm"
              style={{ backgroundColor: "#235347" }}>B</div>
            <div>
              <p className="text-white font-bold text-sm leading-none">BodaCredit</p>
              <p className="text-gray-500 text-xs mt-0.5">Underwriting System</p>
            </div>
          </div>
        </div>

        {/* NAV */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="text-gray-600 text-[10px] uppercase tracking-widest px-3 mb-2">
            Main
          </p>
          <NavItem to="/dashboard"        active icon="⊞">Dashboard</NavItem>
          <NavItem to="/new-application"         icon="＋">New Application</NavItem>
          <NavItem to="/loan-queue"              icon="☰">Loan Queue</NavItem>
          <NavItem to="/portfolio"               icon="◫">Portfolio</NavItem>

          <p className="text-gray-600 text-[10px] uppercase tracking-widest px-3
                        mb-2 mt-5">
            Analysis
          </p>
          <NavItem to="/dashboard" icon="⚑">Risk Review</NavItem>
          <NavItem to="/dashboard" icon="✓">Fairness Logs</NavItem>
        </nav>

        {/* API STATUS + USER + LOGOUT */}
        <div className="px-4 py-4 border-t border-white/10 space-y-3">

          {/* API STATUS */}
          <div className="flex items-center gap-2 text-xs">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
              apiOnline === null ? "bg-yellow-400 animate-pulse"
              : apiOnline ? "bg-emerald-400"
              : "bg-red-400"}`} />
            <span className="text-gray-400">
              {apiOnline === null ? "Connecting..."
               : apiOnline ? "Scoring engine online"
               : "Engine offline"}
            </span>
          </div>

          {/* OFFICER INFO — now reads from AuthContext */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center
                            text-xs font-bold text-white flex-shrink-0"
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

          {/* LOGOUT BUTTON */}
          <button
            onClick={() => {
              logout();
              navigate("LandingPage");
            }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg
                       text-gray-400 hover:text-white hover:bg-red-900/30
                       transition-all duration-150 text-xs font-medium
                       border border-white/5 hover:border-red-900/50"
          >
            <span>⎋</span>
            Sign Out
          </button>

        </div>
      </aside>


      {/* ── MAIN CONTENT ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* TOP BAR */}
        <header className="flex items-center justify-between px-7 py-4 bg-white
                           border-b border-gray-100 flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {now.toLocaleDateString("en-KE", {
                weekday: "long", year: "numeric",
                month: "long", day: "numeric"
              })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link 
  to="/loan-queue"
  className="text-xs px-4 py-2 rounded-lg border border-gray-200
             text-gray-600 hover:bg-gray-50 hover:border-[#235347] transition-colors"
>
  View All Loans
</Link>
            <button
              onClick={() => navigate("/new-application")}
              disabled={!apiOnline}
              className="text-xs px-4 py-2.5 rounded-lg text-white font-semibold
                         transition-all disabled:opacity-40"
              style={{ backgroundColor: "#235347" }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#1a3d32"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#235347"}
            >
               New Application
            </button>
          </div>
        </header>

        {/* SCROLLABLE BODY */}
        <div className="flex-1 overflow-y-auto px-7 py-6 space-y-6">

          {/* ── KPI CARDS ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: "Applications Today",
                value: todayLoans.length,
                sub:   `${loans.length} total all time`,
               
                color: "#235347",
              },
              {
                label: "Amount Approved",
                value: `KES ${fmt(approvedAmount)}`,
                sub:   `${totalApproved} approved loans`,
                
                color: "#166534",
              },
              {
                label: "Avg Credit Score",
                value: loans.length ? avgScore : "—",
                sub:   `Across ${loans.length} scored rider${loans.length !== 1 ? "s" : ""}`,
               
                color: "#235347",
              },
              {
                label: "Riders in System",
                value: riderCount,
                sub:   `${returningCount} returning rider${returningCount !== 1 ? "s" : ""}`,
                
                color: "#235347",
              },
            ].map((k) => (
              <div key={k.label}
                className="bg-white rounded-xl p-5 border border-gray-100
                           hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <p className="text-xs text-gray-400 font-medium uppercase
                                tracking-wider leading-tight">{k.label}</p>
                  <span className="text-xl">{k.icon}</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {typeof k.value === "number"
                    ? <AnimCounter target={k.value} />
                    : k.value}
                </p>
                <p className="text-xs text-gray-400 mt-1">{k.sub}</p>
                <div className="mt-3 h-0.5 rounded-full"
                  style={{ backgroundColor: k.color, opacity: 0.3 }} />
              </div>
            ))}
          </div>

          {/* ── MIDDLE ROW: Queue Preview + Risk Chart ─────────────────── */}
          <div className="grid lg:grid-cols-5 gap-4">

            {/* RECENT QUEUE — 3 cols */}
            <div className="lg:col-span-3 bg-white rounded-xl border border-gray-100">
              <div className="px-5 py-4 border-b border-gray-50 flex items-center
                              justify-between">
                <div>
                  <h2 className="font-bold text-gray-900 text-sm">Recent Applications</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Latest 5 scored riders</p>
                </div>
                <Link to="/loan-queue"
                  className="text-xs font-medium transition-colors"
                  style={{ color: "#235347" }}>
                  View all →
                </Link>
              </div>

              {queuePreview.length === 0 ? (
                <div className="py-16 text-center text-gray-400">
                  <p className="text-3xl mb-3">📭</p>
                  <p className="text-sm">No applications yet</p>
                  <button onClick={() => navigate("/new-application")}
                    className="mt-3 text-xs font-medium"
                    style={{ color: "#235347" }}>
                    Score your first rider →
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {queuePreview.map((loan, i) => {
                    const pd    = loan.scoring?.pd_score ?? null;
                    const score = pd != null ? Math.round((1 - pd) * 100) : null;
                    const tier  = pd != null ? getRiskTier(pd) : null;
                    const rc    = tier ? RISK_COLOR[tier] : null;
                    const dc    = decisionColor(loan.decision ?? "");
                    return (
                      <div key={i}
                        className="px-5 py-3.5 flex items-center gap-4
                                   hover:bg-gray-50/60 transition-colors cursor-pointer"
                        onClick={() => navigate("/loan-queue")}>
                        {/* AVATAR */}
                        <div className="w-9 h-9 rounded-full flex items-center
                                        justify-center text-white text-sm font-bold
                                        flex-shrink-0"
                          style={{ backgroundColor: "#235347" }}>
                          {loan.rider_name?.charAt(0).toUpperCase() ?? "?"}
                        </div>
                        {/* NAME + DATE */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-gray-900 truncate">
                            {loan.rider_name}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            KES {fmt(loan.requested_amount)} ·{" "}
                            {new Date(loan.applied_at).toLocaleDateString("en-KE", {
                              day: "numeric", month: "short"
                            })}
                          </p>
                        </div>
                        {/* SCORE */}
                        {score != null && (
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-bold text-gray-900">
                              {score}<span className="text-xs text-gray-400">/100</span>
                            </p>
                            {rc && (
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                style={{ backgroundColor: rc.bg, color: rc.text }}>
                                {tier}
                              </span>
                            )}
                          </div>
                        )}
                        {/* DECISION */}
                        <span className="text-xs px-2.5 py-1 rounded-full font-semibold
                                         flex-shrink-0"
                          style={{ backgroundColor: dc.bg, color: dc.text }}>
                          {decisionEmoji(loan.decision)} {loan.decision}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* RISK DISTRIBUTION — 2 cols */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100">
              <div className="px-5 py-4 border-b border-gray-50">
                <h2 className="font-bold text-gray-900 text-sm">Risk Distribution</h2>
                <p className="text-xs text-gray-400 mt-0.5">All scored applications</p>
              </div>
              <div className="px-5 py-5 space-y-3">
                {loans.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm py-8">No data yet</p>
                ) : (
                  Object.entries(riskCounts).map(([tier, count]) => {
                    const rc  = RISK_COLOR[tier];
                    const pct = loans.length ? Math.round((count / loans.length) * 100) : 0;
                    return (
                      <div key={tier}>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="font-medium text-gray-700">{tier}</span>
                          <span className="text-gray-400">{count} ({pct}%)</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: rc.dot,
                            }} />
                        </div>
                      </div>
                    );
                  })
                )}

                {/* SUMMARY PILLS */}
                {loans.length > 0 && (
                  <div className="pt-3 border-t border-gray-50 grid grid-cols-3 gap-2 text-center">
                    {[
                      { label: "Approved", val: totalApproved, color: "#166534", bg: "#dcfce7" },
                      { label: "Review",   val: totalReview,   color: "#854d0e", bg: "#fef9c3" },
                      { label: "Declined", val: totalDeclined, color: "#991b1b", bg: "#fee2e2" },
                    ].map((s) => (
                      <div key={s.label} className="rounded-lg py-2"
                        style={{ backgroundColor: s.bg }}>
                        <p className="text-lg font-bold" style={{ color: s.color }}>{s.val}</p>
                        <p className="text-xs" style={{ color: s.color, opacity: 0.8 }}>
                          {s.label}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── BOTTOM ROW: Monthly Chart + Activity Feed ──────────────── */}
          <div className="grid lg:grid-cols-5 gap-4">

            {/* MONTHLY VOLUME CHART — 3 cols */}
            <div className="lg:col-span-3 bg-white rounded-xl border border-gray-100">
              <div className="px-5 py-4 border-b border-gray-50">
                <h2 className="font-bold text-gray-900 text-sm">Monthly Volume</h2>
                <p className="text-xs text-gray-400 mt-0.5">Applications scored per month</p>
              </div>
              <div className="px-5 py-5">
                {loans.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm py-10">
                    No data yet — submit your first application
                  </p>
                ) : (
                  <div className="flex items-end gap-3 h-36">
                    {monthlyData.map((m) => {
                      const heightPct = maxMonthly > 0
                        ? Math.max((m.count / maxMonthly) * 100, m.count > 0 ? 8 : 0)
                        : 0;
                      return (
                        <div key={m.label}
                          className="flex-1 flex flex-col items-center gap-1.5 group">
                          <span className="text-xs font-bold text-gray-700
                                           opacity-0 group-hover:opacity-100 transition-opacity">
                            {m.count}
                          </span>
                          <div className="w-full rounded-t-md transition-all duration-500
                                          cursor-default"
                            style={{
                              height: `${heightPct}%`,
                              backgroundColor: m.count > 0 ? "#235347" : "#e5e7eb",
                              minHeight: "4px",
                            }}
                            title={`${m.label}: ${m.count} application${m.count !== 1 ? "s" : ""}`}
                          />
                          <span className="text-xs text-gray-400">{m.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ACTIVITY FEED — 2 cols */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100">
              <div className="px-5 py-4 border-b border-gray-50">
                <h2 className="font-bold text-gray-900 text-sm">Recent Decisions</h2>
                <p className="text-xs text-gray-400 mt-0.5">Live activity feed</p>
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: "220px" }}>
                {recent.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm py-10">No activity yet</p>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {recent.map((loan, i) => {
                      const dc = decisionColor(loan.decision ?? "");
                      return (
                        <div key={i}
                          className="px-5 py-3 flex items-center gap-3">
                          {/* DECISION DOT */}
                          <span className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: dc.text }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-800 truncate">
                              {loan.rider_name}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5 truncate">
                              {decisionEmoji(loan.decision)} {loan.decision} ·{" "}
                              KES {fmt(loan.recommendation?.recommended_amount ?? 0)}
                            </p>
                          </div>
                          <p className="text-[10px] text-gray-400 flex-shrink-0">
                            {new Date(loan.applied_at).toLocaleTimeString("en-KE", {
                              hour: "2-digit", minute: "2-digit"
                            })}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── EMPTY STATE CTA ────────────────────────────────────────── */}
          {loans.length === 0 && (
            <div className="bg-white rounded-xl border border-dashed border-gray-200
                            p-10 text-center">
              <p className="text-4xl mb-4">🏍️</p>
              <h3 className="font-bold text-gray-900 text-lg">No applications yet</h3>
              <p className="text-gray-500 text-sm mt-2 max-w-xs mx-auto">
                Score your first rider to start seeing KPIs, risk distribution,
                and activity here.
              </p>
              <button
                onClick={() => navigate("/new-application")}
                disabled={!apiOnline}
                className="mt-5 px-6 py-2.5 rounded-lg text-white text-sm font-semibold
                           transition-all disabled:opacity-40"
                style={{ backgroundColor: "#235347" }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#1a3d32"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#235347"}
              >
                Score First Rider →
              </button>
            </div>
          )}

        </div>
        {/* END SCROLL BODY */}
      </div>
    </div>
  );
}
