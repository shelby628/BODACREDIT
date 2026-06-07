import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getAllLoans } from "../utils/loanStore";

export default function Portfolio() {
  const [loans, setLoans] = useState([]);
  const [filter, setFilter] = useState("all");
  const [dateRange, setDateRange] = useState("30");

  useEffect(() => {
    // Load loans from localStorage
    const allLoans = getAllLoans();
    setLoans(allLoans);
  }, []);

  // Calculate portfolio metrics
  const calculateMetrics = () => {
    const activeLoans = loans.filter(l => l.status === "APPROVED" || l.status === "ACTIVE");
    const totalDisbursed = loans.reduce((sum, l) => sum + (l.requested_amount || 0), 0);
    const avgLoanSize = totalDisbursed / (loans.length || 1);
    
    // Risk distribution
    const riskCounts = {
      LOW: 0,
      "LOW-MEDIUM": 0,
      MEDIUM: 0,
      HIGH: 0,
      "VERY HIGH": 0
    };
    
    loans.forEach(loan => {
      const pd = loan.pd_score || 0.5;
      if (pd < 0.20) riskCounts.LOW++;
      else if (pd < 0.35) riskCounts["LOW-MEDIUM"]++;
      else if (pd < 0.50) riskCounts.MEDIUM++;
      else if (pd < 0.65) riskCounts.HIGH++;
      else riskCounts["VERY HIGH"]++;
    });
    
    return { activeLoans: activeLoans.length, totalDisbursed, avgLoanSize, riskCounts };
  };

  const metrics = calculateMetrics();

  return (
    <div className="min-h-screen bg-[#f6f7f9]">
      {/* Sidebar - same as NewApplication */}
      <div className="flex">
        <aside className="w-64 bg-[#111827] text-white p-5 min-h-screen">
          <h1 className="text-2xl font-bold text-[#235347]">BodaCredit</h1>
          <div className="mt-10 space-y-2 text-sm">
            <Link to="/new-application" className="block px-3 py-2 rounded hover:bg-gray-800">New Application</Link>
                  <div className="px-3 py-2 rounded bg-[#235347]">Portfolio</div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">
          <div className="mb-8">
            <h2 className="text-3xl font-bold">Portfolio Overview</h2>
            <p className="text-gray-500 mt-1">Monitor loan performance and portfolio health</p>
          </div>

          {/* Filter Bar */}
          <div className="bg-white rounded-xl p-4 mb-6 flex gap-4">
            <select className="border rounded-lg px-3 py-2 text-sm">
              <option>Last 7 days</option>
              <option>Last 30 days</option>
              <option>Last 90 days</option>
              <option>Year to date</option>
            </select>
            <select className="border rounded-lg px-3 py-2 text-sm">
              <option>All Segments</option>
              <option>Stage Rider</option>
              <option>App Rider</option>
              <option>Hybrid Rider</option>
            </select>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl p-6 border">
              <p className="text-gray-500 text-sm">Active Loans</p>
              <p className="text-3xl font-bold mt-2">{metrics.activeLoans}</p>
            </div>
            <div className="bg-white rounded-xl p-6 border">
              <p className="text-gray-500 text-sm">Total Disbursed</p>
              <p className="text-3xl font-bold mt-2">KES {metrics.totalDisbursed.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-xl p-6 border">
              <p className="text-gray-500 text-sm">Average Loan Size</p>
              <p className="text-3xl font-bold mt-2">KES {Math.round(metrics.avgLoanSize).toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-xl p-6 border">
              <p className="text-gray-500 text-sm">Repayment Rate</p>
              <p className="text-3xl font-bold mt-2 text-green-600">87%</p>
            </div>
          </div>

          {/* Risk Distribution */}
          <div className="bg-white rounded-xl p-6 border mb-8">
            <h3 className="text-lg font-semibold mb-4">Risk Distribution</h3>
            <div className="space-y-3">
              {Object.entries(metrics.riskCounts).map(([tier, count]) => (
                <div key={tier}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{tier}</span>
                    <span>{count} loans ({Math.round((count / loans.length) * 100)}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        tier === "LOW" ? "bg-green-500" :
                        tier === "LOW-MEDIUM" ? "bg-green-400" :
                        tier === "MEDIUM" ? "bg-yellow-500" :
                        tier === "HIGH" ? "bg-orange-500" : "bg-red-500"
                      }`}
                      style={{ width: `${(count / loans.length) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Loans Table */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">Recent Loans</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Rider</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Risk</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loans.slice(0, 10).map((loan) => (
                    <tr key={loan.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm">{loan.rider_name}</td>
                      <td className="px-6 py-4 text-sm">KES {loan.requested_amount?.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          (loan.pd_score || 0.5) < 0.20 ? "bg-green-100 text-green-800" :
                          (loan.pd_score || 0.5) < 0.35 ? "bg-green-100 text-green-800" :
                          (loan.pd_score || 0.5) < 0.50 ? "bg-yellow-100 text-yellow-800" :
                          (loan.pd_score || 0.5) < 0.65 ? "bg-orange-100 text-orange-800" :
                          "bg-red-100 text-red-800"
                        }`}>
                          {Math.round((1 - (loan.pd_score || 0.5)) * 100)}/100
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          loan.status === "APPROVED" ? "bg-green-100 text-green-800" :
                          loan.status === "DECLINED" ? "bg-red-100 text-red-800" :
                          "bg-yellow-100 text-yellow-800"
                        }`}>
                          {loan.status || "PENDING"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(loan.submitted_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}