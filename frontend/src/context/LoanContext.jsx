import { createContext, useContext, useState, useEffect } from "react";
import {
  fetchApplications,
  saveApplicationApi,
  overrideApplicationApi,
} from "../utils/api";
import { useAuth } from "./AuthContext";

const LoanContext = createContext();

export function LoanProvider({ children }) {
  const { officer } = useAuth();
  const [rawApplications, setApplications] = useState([]);

  // Only show data while an officer is logged in
  const applications = officer ? rawApplications : [];

  // Load from the database when an officer is logged in
  useEffect(() => {
    if (!officer) return;
    fetchApplications()
      .then(setApplications)
      .catch((e) => console.error("Could not load applications:", e));
  }, [officer]);

  // Returns the new id, or null if saving failed
  const addApplication = async (app) => {
    try {
      const { id } = await saveApplicationApi(app);
      const newApp = {
        ...app,
        id,
        submitted_at: new Date().toISOString(),
        officer_decision: null,
      };
      setApplications((prev) => [newApp, ...prev]);
      return id;
    } catch (e) {
      console.error("Save failed:", e);
      return null;
    }
  };

  const updateStatus = async (id, officerDecision) => {
    const before = applications;
    setApplications((prev) =>
      prev.map((a) => (a.id === id ? { ...a, officer_decision: officerDecision } : a))
    );
    try {
      await overrideApplicationApi(id, officerDecision);
    } catch (e) {
      console.error("Override failed:", e);
      setApplications(before); // undo on failure
    }
  };

  return (
    <LoanContext.Provider value={{ applications, addApplication, updateStatus }}>
      {children}
    </LoanContext.Provider>
  );
}

export const useLoanContext = () => useContext(LoanContext);