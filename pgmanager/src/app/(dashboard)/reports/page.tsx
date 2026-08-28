"use client";

import { useState, useEffect } from "react";
import { BarChart3, Download, FileText, Users, BedDouble, IndianRupee } from "lucide-react";

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

export default function ReportsPage() {
  const [dashData, setDashData] = useState<any>(null);
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeReport, setActiveReport] = useState("financial");

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard").then((r) => r.json()),
      fetch("/api/tenants?status=ACTIVE").then((r) => r.json()),
    ]).then(([d, t]) => { setDashData(d); setTenants(t); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading reports…</div>;
  }

  const reports = [
    { id: "financial", label: "Financial Summary", icon: IndianRupee },
    { id: "tenant", label: "Tenant Report", icon: Users },
    { id: "occupancy", label: "Occupancy Report", icon: BedDouble },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-sm text-muted-foreground">View and export financial and occupancy reports</p>
      </div>

      <div className="flex gap-2">
        {reports.map((r) => (
          <button key={r.id} onClick={() => setActiveReport(r.id)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              activeReport === r.id ? "bg-primary/10 border-primary/30 text-primary" : "bg-card hover:bg-muted"
            }`}>
            <r.icon className="w-4 h-4" /> {r.label}
          </button>
        ))}
      </div>

      {/* Financial Report */}
      {activeReport === "financial" && dashData && (
        <div className="space-y-4">
          <div className="bg-card border rounded-xl p-6">
            <h2 className="font-semibold mb-4">Financial Summary</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { label: "Total Revenue", value: fmt(dashData.financial.totalCollection) },
                { label: "Total Expenses", value: fmt(dashData.financial.totalExpenses) },
                { label: "Net Income", value: fmt(dashData.financial.netIncome) },
                { label: "Current Month Revenue", value: fmt(dashData.financial.currentMonthCollection) },
                { label: "Current Month Expenses", value: fmt(dashData.financial.currentMonthExpenses) },
                { label: "Pending Rent", value: fmt(dashData.financial.pendingRent) },
                { label: "Overdue Rent", value: fmt(dashData.financial.overdueRent) },
              ].map((item) => (
                <div key={item.label} className="p-3 bg-background rounded-lg">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-lg font-bold mt-1">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly breakdown */}
          <div className="bg-card border rounded-xl p-6">
            <h2 className="font-semibold mb-4">Monthly Breakdown</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="pb-2 font-medium">Month</th>
                    <th className="pb-2 font-medium">Revenue</th>
                    <th className="pb-2 font-medium">Expenses</th>
                    <th className="pb-2 font-medium">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {dashData.charts?.monthlyRevenue?.map((m: any) => (
                    <tr key={m.month} className="border-b last:border-0">
                      <td className="py-2 font-medium">{m.month}</td>
                      <td className="py-2 text-emerald-500">{fmt(m.revenue)}</td>
                      <td className="py-2 text-red-500">{fmt(m.expenses)}</td>
                      <td className={`py-2 font-medium ${m.net >= 0 ? "text-emerald-500" : "text-red-500"}`}>{fmt(m.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tenant Report */}
      {activeReport === "tenant" && (
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h2 className="font-semibold">Tenant Payment Status</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b bg-muted/50">
                  <th className="px-4 py-3 font-medium">Tenant</th>
                  <th className="px-4 py-3 font-medium">Room/Bed</th>
                  <th className="px-4 py-3 font-medium">Monthly Rent</th>
                  <th className="px-4 py-3 font-medium">Paid</th>
                  <th className="px-4 py-3 font-medium">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">{t.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{t.roomNumber ? `${t.roomNumber}/${t.bedNumber}` : "—"}</td>
                    <td className="px-4 py-3">{fmt(t.monthlyRent)}</td>
                    <td className="px-4 py-3 text-emerald-500">{fmt(t.currentMonthPaid)}</td>
                    <td className={`px-4 py-3 font-medium ${t.outstanding > 0 ? "text-red-500" : ""}`}>{fmt(t.outstanding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Occupancy Report */}
      {activeReport === "occupancy" && dashData && (
        <div className="bg-card border rounded-xl p-6">
          <h2 className="font-semibold mb-4">Occupancy Report</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-background rounded-lg text-center">
              <p className="text-3xl font-bold">{dashData.occupancy.totalRooms}</p>
              <p className="text-xs text-muted-foreground mt-1">Total Rooms</p>
            </div>
            <div className="p-4 bg-background rounded-lg text-center">
              <p className="text-3xl font-bold">{dashData.occupancy.totalBeds}</p>
              <p className="text-xs text-muted-foreground mt-1">Total Beds</p>
            </div>
            <div className="p-4 bg-emerald-500/10 rounded-lg text-center">
              <p className="text-3xl font-bold text-emerald-500">{dashData.occupancy.occupiedBeds}</p>
              <p className="text-xs text-muted-foreground mt-1">Occupied</p>
            </div>
            <div className="p-4 bg-amber-500/10 rounded-lg text-center">
              <p className="text-3xl font-bold text-amber-500">{dashData.occupancy.vacantBeds}</p>
              <p className="text-xs text-muted-foreground mt-1">Vacant</p>
            </div>
          </div>
          <div className="mt-6">
            <div className="flex justify-between text-sm mb-2">
              <span>Occupancy Rate</span>
              <span className="font-bold">{dashData.occupancy.occupancyRate}%</span>
            </div>
            <div className="w-full h-4 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${dashData.occupancy.occupancyRate}%` }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
