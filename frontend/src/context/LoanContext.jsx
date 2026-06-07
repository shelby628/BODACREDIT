import { createContext, useContext, useState, useEffect } from "react";
import { getAllLoans, saveLoan, saveRiderProfile } from "../utils/loanStore";

const LoanContext = createContext();

export function LoanProvider({ children }) {
  const [applications, setApplications] = useState(() => {
    const loans = getAllLoans();
    return loans.length > 0 ? loans : [];
  });

  // Sync status-only updates back to localStorage
  useEffect(() => {
    if (applications.length > 0) {
      const lastApp = applications[0];
      if (lastApp) {
        const allLoans = getAllLoans();
        const updatedLoans = allLoans.map((loan) =>
          loan.id === lastApp.id ? lastApp : loan
        );
        localStorage.setItem("bodacredit_loans", JSON.stringify(updatedLoans));
      }
    }
  }, [applications]);

  const addApplication = (app) => {
    const newApp = {
      ...app,
      id:           `APP-${Date.now()}`,
      submitted_at: new Date().toISOString(),
      status:       app.decision ?? "PENDING",
      officer_decision: null,   // ← starts null; set when officer manually acts
    };

    setApplications((prev) => [newApp, ...prev]);
    saveLoan(newApp);

    if (app.national_id) {
      const riderProfile = {
        national_id:             app.national_id,
        full_name:               app.rider_name,
        phone_number:            app.phone_number,
        rider_segment:           app.rider_segment,
        bike_ownership:          app.bike_ownership,
        avg_daily_income:        app.avg_daily_income,
        is_sacco_member:         app.is_sacco_member,
        sacco_tenure_months:     app.sacco_tenure_months,
        sacco_contribution_rate: app.sacco_contribution_rate,
        total_loans_taken:       app.total_loans_taken,
        on_time_repayment_rate:  app.on_time_repayment_rate,
        ever_defaulted:          app.ever_defaulted,
        active_digital_loans:    app.active_digital_loans,
        last_loan_date:          newApp.submitted_at,
        loan_count:              (app.previous_loan_count || 0) + 1,
      };
      saveRiderProfile(app.national_id, riderProfile);
    }

    return newApp.id;
  };

  // FIX — stores officer_decision separately from ML decision,
  // and matches loans by BOTH id and rider_id so localStorage always updates
  const updateStatus = (id, officerDecision) => {
    setApplications((prev) => {
      const updated = prev.map((a) =>
        a.id === id
          ? { ...a, officer_decision: officerDecision, status: officerDecision }
          : a
      );

      // Persist to localStorage — match by id OR rider_id (belt-and-suspenders)
      const allLoans = getAllLoans();
      const updatedLoans = allLoans.map((loan) =>
        loan.id === id || loan.rider_id === id
          ? { ...loan, officer_decision: officerDecision, status: officerDecision }
          : loan
      );
      localStorage.setItem("bodacredit_loans", JSON.stringify(updatedLoans));

      return updated;
    });
  };

  return (
    <LoanContext.Provider value={{ applications, addApplication, updateStatus }}>
      {children}
    </LoanContext.Provider>
  );
}

export const useLoanContext = () => useContext(LoanContext);