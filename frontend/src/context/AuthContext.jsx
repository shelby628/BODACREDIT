import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();
const OFFICER_KEY = "bodacredit_officer";
const API_URL     = "https://bodacredit.onrender.com";

export function AuthProvider({ children }) {
  const [officer, setOfficer] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(OFFICER_KEY) ?? "null");
    } catch { return null; }
  });

  // On app load, verify session is still valid with backend
  useEffect(() => {
    fetch(`${API_URL}/me`, {
      credentials: "include", // sends the httpOnly cookie automatically
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          const o = { name: data.full_name, sacco_id: data.sacco_id };
          setOfficer(o);
          localStorage.setItem(OFFICER_KEY, JSON.stringify(o));
        } else {
          // Session expired or invalid
          setOfficer(null);
          localStorage.removeItem(OFFICER_KEY);
        }
      })
      .catch(() => {});
  }, []);

  const login = ({ officer_name, sacco_id }) => {
    // No token to store — cookie is set by backend automatically
    const o = { name: officer_name, sacco_id };
    setOfficer(o);
    localStorage.setItem(OFFICER_KEY, JSON.stringify(o)); // only non-sensitive profile info
  };

  const logout = async () => {
    await fetch(`${API_URL}/auth/logout`, {
      method:      "POST",
      credentials: "include", // sends cookie so backend can clear it
    });
    setOfficer(null);
    localStorage.removeItem(OFFICER_KEY);
  };

  const isAuthenticated = !!officer;

  return (
    <AuthContext.Provider value={{ officer, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);