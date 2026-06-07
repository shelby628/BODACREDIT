import { createContext, useContext, useState } from "react";

const AuthContext = createContext();

const TOKEN_KEY   = "bodacredit_token";
const OFFICER_KEY = "bodacredit_officer";

// ── Helpers ────────────────────────────────────────────────────────────────
const loadFromStorage = () => {
  try {
    return {
      token:   localStorage.getItem(TOKEN_KEY)   ?? null,
      officer: JSON.parse(localStorage.getItem(OFFICER_KEY) ?? "null"),
    };
  } catch {
    return { token: null, officer: null };
  }
};

// ── Provider ───────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(loadFromStorage);

  /**
   * Called after a successful /auth/login response.
   * Stores the token and officer profile in both state and localStorage
   * so they survive a page refresh.
   */
  const login = ({ access_token, officer_name, sacco_id }) => {
    const officer = { name: officer_name, sacco_id };
    localStorage.setItem(TOKEN_KEY,   access_token);
    localStorage.setItem(OFFICER_KEY, JSON.stringify(officer));
    setAuth({ token: access_token, officer });
  };

  /**
   * Clears everything — token, officer profile, loan data.
   * Redirecting to /login is handled by the caller (usually a logout button).
   */
  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(OFFICER_KEY);
    setAuth({ token: null, officer: null });
  };

  const isAuthenticated = !!auth.token;

  return (
    <AuthContext.Provider value={{
      token:           auth.token,
      officer:         auth.officer,
      isAuthenticated,
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
