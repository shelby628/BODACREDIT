import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

let bodaImage = null;
try {
  bodaImage = new URL("./assets/bodarider.jpg", import.meta.url).href;
} catch {
  bodaImage = null;
}

// ── Intersection observer hook for scroll-reveal ───────────────────────────
function useReveal() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.15 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

// ── Animated counter ───────────────────────────────────────────────────────
function Counter({ target, suffix = "", prefix = "" }) {
  const [count, setCount] = useState(0);
  const [ref, visible] = useReveal();
  useEffect(() => {
    if (!visible) return;
    const num = parseFloat(target);
    const isDecimal = String(target).includes(".");
    const duration = 1400;
    const steps = 50;
    let i = 0;
    const timer = setInterval(() => {
      i++;
      const progress = i / steps;
      const eased = 1 - Math.pow(1 - progress, 3);
      const val = eased * num;
      setCount(isDecimal ? parseFloat(val.toFixed(2)) : Math.floor(val));
      if (i >= steps) clearInterval(timer);
    }, duration / steps);
    return () => clearInterval(timer);
  }, [visible, target]);
  return (
    <span ref={ref}>
      {prefix}{count}{suffix}
    </span>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [apiStatus, setApiStatus] = useState("checking");
  const [menuOpen,  setMenuOpen]  = useState(false);
  const [scrolled,  setScrolled]  = useState(false);

  useEffect(() => {
    fetch("http://localhost:8000/health")
      .then((r) => r.json())
      .then(() => setApiStatus("online"))
      .catch(() => setApiStatus("offline"));
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks = [
    { label: "Features",     href: "#features" },
    { label: "How It Works", href: "#how"      },
    { label: "Impact",       href: "#impact"   },
    { label: "About",        href: "#about"    },
  ];

  const statusDot = {
    checking: "bg-yellow-400 animate-pulse",
    online:   "bg-emerald-400",
    offline:  "bg-red-400",
  }[apiStatus];

  const statusMsg = {
    checking: "Connecting to scoring engine...",
    online:   "Scoring engine online",
    offline:  "Scoring engine offline — run: uvicorn main:app --reload --port 8000",
  }[apiStatus];

  // ── SCROLL-REVEAL REFS ───────────────────────────────────────────────────
  const [featRef, featVis] = useReveal();
  const [howRef,  howVis]  = useReveal();
  const [impRef,  impVis]  = useReveal();
  const [ctaRef,  ctaVis]  = useReveal();

  return (
    <div className="min-h-screen text-gray-900 scroll-smooth"
      style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>

      {/* ── FIXED HEADER ──────────────────────────────────────────────── */}
      <div className="fixed top-0 left-0 w-full z-50">

        {/* STATUS BAR */}
        <div className="px-6 py-1.5 flex items-center gap-2 text-xs
                        bg-[#1a3d32] text-gray-300">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDot}`} />
          {statusMsg}
          <span className="ml-auto opacity-50">BodaCredit v1.0</span>
        </div>

        {/* NAVBAR */}
        <nav className={`transition-all duration-300 border-b
          ${scrolled
            ? "bg-white/95 backdrop-blur-md border-gray-200 shadow-sm"
            : "bg-transparent border-transparent"}`}>
          <div className="max-w-7xl mx-auto flex items-center justify-between px-8 py-4">

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: "#235347" }}>
                <span className="text-white text-sm font-bold">B</span>
              </div>
              <span className={`text-xl font-bold tracking-tight transition-colors
                ${scrolled ? "text-gray-900" : "text-white"}`}>
                BodaCredit
              </span>
            </div>

            {/* DESKTOP LINKS */}
            <div className="hidden md:flex items-center gap-8 text-sm font-medium">
              {navLinks.map((l) => (
                <a key={l.href} href={l.href}
                  className={`transition-colors hover:opacity-100
                    ${scrolled ? "text-gray-600 hover:text-[#235347]"
                               : "text-white/80 hover:text-white"}`}>
                  {l.label}
                </a>
              ))}
            </div>

            {/* CHANGED: /dashboard → /login */}
            <button
              disabled={apiStatus !== "online"}
              onClick={() => navigate("/login")}
              className="hidden md:flex items-center gap-2 px-5 py-2.5 rounded-lg
                         text-sm font-semibold transition-all
                         disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: "#235347", color: "white" }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#1a3d32"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#235347"}
            >
              {apiStatus === "online" ? (
                <>Sign In <span className="text-xs">→</span></>
              ) : "Connecting..."}
            </button>

            {/* MOBILE HAMBURGER */}
            <button className="md:hidden p-2" onClick={() => setMenuOpen(!menuOpen)}>
              <div className="space-y-1.5">
                <span className={`block w-6 h-0.5 transition-all duration-200
                  ${scrolled ? "bg-gray-700" : "bg-white"}
                  ${menuOpen ? "rotate-45 translate-y-2" : ""}`} />
                <span className={`block w-6 h-0.5 transition-all duration-200
                  ${scrolled ? "bg-gray-700" : "bg-white"}
                  ${menuOpen ? "opacity-0" : ""}`} />
                <span className={`block w-6 h-0.5 transition-all duration-200
                  ${scrolled ? "bg-gray-700" : "bg-white"}
                  ${menuOpen ? "-rotate-45 -translate-y-2" : ""}`} />
              </div>
            </button>
          </div>

          {/* MOBILE DROPDOWN */}
          {menuOpen && (
            <div className="md:hidden bg-white border-t px-8 py-5 space-y-4 text-sm">
              {navLinks.map((l) => (
                <a key={l.href} href={l.href}
                  onClick={() => setMenuOpen(false)}
                  className="block text-gray-700 hover:text-[#235347]">
                  {l.label}
                </a>
              ))}
              {/* CHANGED: /dashboard → /login */}
              <button
                disabled={apiStatus !== "online"}
                onClick={() => { setMenuOpen(false); navigate("/login"); }}
                className="w-full py-2.5 rounded-lg text-white text-sm font-semibold
                           disabled:opacity-40"
                style={{ backgroundColor: "#235347" }}
              >
                Sign In
              </button>
            </div>
          )}
        </nav>
      </div>

      {/* ── HERO ──────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center"
        style={{
          backgroundImage: bodaImage
            ? `url(${bodaImage})`
            : `linear-gradient(135deg, #0f2920 0%, #235347 50%, #1a3d32 100%)`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}>

        <div className="absolute inset-0"
          style={{ background: "linear-gradient(135deg, rgba(10,25,18,0.88) 0%, rgba(35,83,71,0.65) 100%)" }} />
        <div className="absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 60%)" }} />
        <div className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }} />

        <div className="relative z-10 max-w-7xl mx-auto px-8 pt-32 pb-24 w-full">
          <div className="max-w-3xl">

            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full
                            border border-white/20 text-xs text-gray-300 mb-8
                            backdrop-blur-sm bg-white/5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              AI-Powered SACCO Underwriting · Nairobi, Kenya
            </div>

            <h1 className="text-5xl md:text-7xl font-bold text-white leading-[1.05]
                           tracking-tight"
              style={{ fontFamily: "'Georgia', serif" }}>
              Credit Scoring<br />
              Built for<br />
              Boda Riders
            </h1>

            <p className="mt-7 text-lg text-gray-300 max-w-xl leading-relaxed"
              style={{ fontFamily: "'Georgia', serif", fontStyle: "italic" }}>
              Fast, fair, and explainable lending decisions for Nairobi's
              motorcycle taxi riders.
            </p>

            <div className="mt-10 flex gap-4 flex-wrap">
              {/* CHANGED: /dashboard → /login */}
              <button
                onClick={() => navigate("/login")}
                disabled={apiStatus !== "online"}
                className="px-8 py-3.5 rounded-lg text-white font-semibold text-sm
                           transition-all disabled:opacity-40 disabled:cursor-not-allowed
                           shadow-lg"
                style={{ backgroundColor: "#235347" }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#1a3d32"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#235347"}
              >
                Start Scoring Riders →
              </button>
              <a href="#how"
                className="px-8 py-3.5 rounded-lg font-semibold text-sm transition-all
                           border border-white/30 text-white hover:bg-white/10">
                See How It Works
              </a>
            </div>

            {/* METRICS ROW */}
            <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { value: 54,   suffix: "",  label: "Model Features"              },
                { value: 0.82, suffix: "",  label: "AUC Score"                   },
                { value: 30,   suffix: "s", label: "Decision Time",  prefix: "<" },
                { value: 9,    suffix: "",  label: "Fairness Checks"             },
              ].map((m) => (
                <div key={m.label}
                  className="border-l-2 pl-4"
                  style={{ borderColor: "#6dbfa8" }}>
                  <p className="text-3xl font-bold text-white">
                    <Counter target={m.value} suffix={m.suffix} prefix={m.prefix ?? ""} />
                  </p>
                  <p className="text-xs text-gray-400 mt-1 uppercase tracking-wider">
                    {m.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────────────── */}
      <section id="features" ref={featRef} className="py-28 px-8 bg-white">
        <div className="max-w-6xl mx-auto">

          <div className={`transition-all duration-700
            ${featVis ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            <p className="text-xs uppercase tracking-[0.2em] font-semibold mb-3"
              style={{ color: "#235347" }}>
              Why BodaCredit
            </p>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 max-w-xl leading-tight"
              style={{ fontFamily: "'Georgia', serif" }}>
              What makes this system different
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mt-16">
            {[
              {
                num: "01", icon: "🔍",
                title: "Explainable Decisions",
                desc: "Every credit score comes with a plain-English breakdown of the key factors that drove it. Loan officers understand exactly why a rider was approved or declined — no black box.",
              },
              {
                num: "02", icon: "⚖️",
                title: "Built-in Fairness",
                desc: "9 automated fairness checks run on every application. Seasonal income dips (rain season) are not penalised. First-time borrowers are not treated as high risk by default.",
              },
              {
                num: "03", icon: "🧠",
                title: "Rider Memory",
                desc: "Returning riders are recognised by National ID. Their full history pre-fills automatically. The system knows them — so the loan officer doesn't have to start from scratch.",
              },
              {
                num: "04", icon: "📱",
                title: "Income Verification",
                desc: "M-Pesa statement analysis calculates Net Disposable Income automatically. Fuel costs, hire fees, and household expenses are factored in — giving a realistic picture of repayment capacity.",
              },
              {
                num: "05", icon: "⚙️",
                title: "Dual ML Engine",
                desc: "XGBoost and LightGBM run in parallel. Their probability scores are ensembled for a more stable prediction. AUC of 0.82 on historical boda rider lending data.",
              },
              {
                num: "06", icon: "⚡",
                title: "Under 30 Seconds",
                desc: "From the moment a loan officer clicks Submit, the full credit decision — score, risk tier, recommended amount, and daily M-Pesa repayment — is returned in under 30 seconds.",
              },
            ].map((f, i) => (
              <div key={f.num}
                className={`group border border-gray-100 rounded-2xl p-7 hover:shadow-lg
                             transition-all duration-500 hover:-translate-y-1
                  ${featVis ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
                style={{ transitionDelay: `${i * 80}ms` }}>
                <div className="flex items-start justify-between mb-5">
                  <span className="text-2xl">{f.icon}</span>
                  <span className="text-xs font-mono text-gray-300">{f.num}</span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-3"
                  style={{ fontFamily: "'Georgia', serif" }}>
                  {f.title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
                <div className="mt-5 w-8 h-0.5 transition-all duration-300 group-hover:w-16"
                  style={{ backgroundColor: "#235347" }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────── */}
      <section id="how" ref={howRef} className="py-28 px-8"
        style={{ backgroundColor: "#f5f7f5" }}>
        <div className="max-w-6xl mx-auto">

          <div className={`text-center mb-16 transition-all duration-700
            ${howVis ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            <p className="text-xs uppercase tracking-[0.2em] font-semibold mb-3"
              style={{ color: "#235347" }}>
              The Process
            </p>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900"
              style={{ fontFamily: "'Georgia', serif" }}>
              From application to decision
            </h2>
            <p className="mt-4 text-gray-500 text-base max-w-xl mx-auto">
              A loan officer can complete the full scoring pipeline in under 5 minutes.
            </p>
          </div>

          <div className="relative">
            <div className="hidden md:block absolute top-10 left-0 right-0 h-px
                            bg-gray-200 z-0"
              style={{ marginLeft: "10%", marginRight: "10%" }} />
            <div className="grid md:grid-cols-4 gap-8 relative z-10">
              {[
                {
                  step: "1", title: "Rider Identity",
                  desc: "Enter National ID. System checks for returning rider and pre-fills their history.",
                },
                {
                  step: "2", title: "Loan & Income",
                  desc: "Enter requested amount and M-Pesa average daily income. NDI auto-calculated.",
                },
                {
                  step: "3", title: "SACCO History",
                  desc: "Record SACCO membership, contribution rate, and prior loan repayment track record.",
                },
                {
                  step: "4", title: "Instant Decision",
                  desc: "ML engine returns credit score, risk tier, approved amount, and daily repayment figure.",
                },
              ].map((s, i) => (
                <div key={s.step}
                  className={`text-center transition-all duration-700
                    ${howVis ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
                  style={{ transitionDelay: `${i * 120}ms` }}>
                  <div className="w-20 h-20 rounded-full border-2 mx-auto flex items-center
                                  justify-center text-2xl font-bold text-white mb-5"
                    style={{ backgroundColor: "#235347", borderColor: "#235347" }}>
                    {s.step}
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2"
                    style={{ fontFamily: "'Georgia', serif" }}>
                    {s.title}
                  </h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── IMPACT NUMBERS ────────────────────────────────────────────── */}
      <section id="impact" ref={impRef} className="py-28 px-8 text-white"
        style={{ backgroundColor: "#235347" }}>
        <div className="max-w-6xl mx-auto">

          <div className={`text-center mb-16 transition-all duration-700
            ${impVis ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            <p className="text-xs uppercase tracking-[0.2em] font-semibold mb-3 text-white/60">
              By The Numbers
            </p>
            <h2 className="text-4xl md:text-5xl font-bold"
              style={{ fontFamily: "'Georgia', serif" }}>
              Designed for real impact
            </h2>
            <p className="mt-4 text-white/60 text-base max-w-xl mx-auto">
              Built around the realities of boda boda lending in Nairobi's SACCO ecosystem.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: 54,  suffix: "",   label: "Features fed to the model"         },
              { value: 82,  suffix: "%",  label: "Model accuracy (AUC)"              },
              { value: 9,   suffix: "",   label: "Automated fairness checks"          },
              { value: 30,  suffix: "s",  label: "Average time to decision", prefix: "<" },
            ].map((m, i) => (
              <div key={m.label}
                className={`text-center border-t-2 border-white/20 pt-8
                             transition-all duration-700
                  ${impVis ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
                style={{ transitionDelay: `${i * 100}ms` }}>
                <p className="text-5xl font-bold">
                  <Counter target={m.value} suffix={m.suffix} prefix={m.prefix ?? ""} />
                </p>
                <p className="text-sm text-white/60 mt-2 leading-snug">{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ABOUT / CTA ───────────────────────────────────────────────── */}
      <section id="about" ref={ctaRef} className="py-28 px-8 bg-white">
        <div className="max-w-4xl mx-auto text-center">

          <div className={`transition-all duration-700
            ${ctaVis ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            <p className="text-xs uppercase tracking-[0.2em] font-semibold mb-3"
              style={{ color: "#235347" }}>
              Built for SACCOs
            </p>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight"
              style={{ fontFamily: "'Georgia', serif" }}>
              Lending decisions that are fast,<br />
              <span style={{ color: "#235347" }}>fair, and defensible.</span>
            </h2>
            <p className="mt-6 text-gray-500 text-lg leading-relaxed max-w-2xl mx-auto">
              BodaCredit was built to close the gap between boda riders who need credit
              and SACCOs who need confidence. Every decision is logged, explainable,
              and auditable.
            </p>

            <div className="mt-10 flex gap-4 justify-center flex-wrap">
              {/* CHANGED: /dashboard → /login */}
              <button
                onClick={() => navigate("/login")}
                disabled={apiStatus !== "online"}
                className="px-8 py-4 rounded-lg text-white font-semibold text-sm
                           transition-all shadow-lg disabled:opacity-40
                           disabled:cursor-not-allowed"
                style={{ backgroundColor: "#235347" }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#1a3d32"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#235347"}
              >
                Sign In to Dashboard →
              </button>
              {/* CHANGED: /new-application → /login */}
              <button
                onClick={() => navigate("/login")}
                disabled={apiStatus !== "online"}
                className="px-8 py-4 rounded-lg font-semibold text-sm transition-all
                           border-2 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ borderColor: "#235347", color: "#235347" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#235347";
                  e.currentTarget.style.color = "white";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "#235347";
                }}
              >
                Score a Rider Now
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────── */}
      <footer className="py-10 px-8 border-t border-gray-100"
        style={{ backgroundColor: "#f5f7f5" }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center
                        justify-between gap-4 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded flex items-center justify-center"
              style={{ backgroundColor: "#235347" }}>
              <span className="text-white text-xs font-bold">B</span>
            </div>
            <span className="font-semibold text-gray-600">BodaCredit</span>
            <span className="mx-2">·</span>
            <span>AI-Powered SACCO Underwriting</span>
          </div>
          <div className="flex items-center gap-6">
            {["Features", "How It Works", "Sign In"].map((l) => (
              <a key={l}
                href={l === "Sign In" ? "#" : `#${l.toLowerCase().replace(/ /g, "")}`}
                onClick={l === "Sign In" ? () => navigate("/login") : undefined}
                className="hover:text-[#235347] transition-colors">
                {l}
              </a>
            ))}
          </div>
          <span>© {new Date().getFullYear()} BodaCredit</span>
        </div>
      </footer>

    </div>
  );
}
