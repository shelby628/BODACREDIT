import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { BrowserRouter } from "react-router-dom";
import { LoanProvider } from "./context/LoanContext"; // ← add this

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <LoanProvider>
        <App />
      </LoanProvider>
    </BrowserRouter>
  </React.StrictMode>
);