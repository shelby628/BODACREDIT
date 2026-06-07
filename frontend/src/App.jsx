import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { LoanProvider } from "./context/LoanContext";
import ProtectedRoute from "./components/ProtectedRoute";

import LandingPage      from "./pages/LandingPage";
import LoginPage        from "./pages/LoginPage";
import Dashboard        from "./pages/Dashboard";
import Portfolio        from "./pages/Portfolio";
import ScoreApplication from "./pages/ScoreApplication";
import NewApplication   from "./pages/NewApplication";
import LoanQueue        from "./pages/LoanQueue";

export default function App() {
  return (
    <AuthProvider>
      <LoanProvider>
        <Routes>

          {/* PUBLIC */}
          <Route path="/"      element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* PROTECTED */}
          <Route path="/dashboard" element={
            <ProtectedRoute><Dashboard /></ProtectedRoute>
          } />
          <Route path="/new-application" element={
            <ProtectedRoute><NewApplication /></ProtectedRoute>
          } />
          <Route path="/loan-queue" element={
            <ProtectedRoute><LoanQueue /></ProtectedRoute>
          } />
          <Route path="/portfolio" element={
            <ProtectedRoute><Portfolio /></ProtectedRoute>
          } />
          <Route path="/score-application" element={
            <ProtectedRoute><ScoreApplication /></ProtectedRoute>
          } />

          {/* CATCH-ALL */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </LoanProvider>
    </AuthProvider>
  );
}