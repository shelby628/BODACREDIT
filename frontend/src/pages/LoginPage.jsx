import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const API_URL = "https://bodacredit.onrender.com";
export default function LoginPage() {
  const navigate              = useNavigate();
  const { login }             = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState(null);
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password.trim()) {
      setError("Please enter your username and password.");
      return;
    }

    setLoading(true);

    try {
      // FastAPI's OAuth2PasswordRequestForm expects form-encoded data
      const form = new URLSearchParams();
      form.append("username", username.trim());
      form.append("password", password);

      const response = await fetch(`${API_URL}/auth/login`, {
        method:  "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body:    form.toString(),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.detail ?? "Login failed. Check your credentials.");
        return;
      }

      // Store token + officer info in AuthContext (and localStorage)
      login({
        access_token: data.access_token,
        officer_name: data.officer_name,
        sacco_id:     data.sacco_id,
      });

      // Redirect to dashboard
      navigate("/dashboard", { replace: true });

    } catch (err) {
      console.error("Login error:", err);
      setError("Cannot connect to server. Is the scoring engine running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: "#f4f6f4" }}
    >
      <div className="w-full max-w-md">

        {/* CARD */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">

          {/* LOGO */}
          <div className="flex items-center gap-3 mb-8">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center
                         font-bold text-white text-base"
              style={{ backgroundColor: "#235347" }}
            >
              B
            </div>
            <div>
              <p className="font-bold text-gray-900 text-lg leading-none">
                BodaCredit
              </p>
              <p className="text-gray-400 text-xs mt-0.5">Underwriting System</p>
            </div>
          </div>

          {/* HEADING */}
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            Sign in
          </h1>
          <p className="text-gray-400 text-sm mb-7">
            Enter your loan officer credentials to continue.
          </p>

          {/* FORM */}
          <form onSubmit={handleSubmit} className="space-y-4">

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. officer_sacco1"
                autoComplete="username"
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm
                           focus:outline-none focus:ring-2 focus:ring-[#235347]
                           focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm
                           focus:outline-none focus:ring-2 focus:ring-[#235347]
                           focus:border-transparent transition"
              />
            </div>

            {/* ERROR */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3
                              text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* SUBMIT */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg text-white text-sm font-semibold
                         transition-all disabled:opacity-60 mt-2"
              style={{ backgroundColor: "#235347" }}
              onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = "#1a3d32")}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#235347"}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent
                                   rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                "Sign in"
              )}
            </button>

          </form>
        </div>

        {/* FOOTER */}
        <p className="text-center text-xs text-gray-400 mt-6">
          BodaCredit · SACCO Underwriting Platform · Nairobi
        </p>

      </div>
    </div>
  );
}
