"use client";

import { useState, useEffect } from "react";
import { IndianRupee, CheckCircle2, Clock, AlertTriangle, Minus } from "lucide-react";

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

const STATUS_CONFIG: Record<string, { icon: any; color: string; badge: string }> = {
  PAID: { icon: CheckCircle2, color: "text-emerald-500", badge: "bg-emerald-500/10 text-emerald-600" },
  PARTIAL: { icon: Minus, color: "text-amber-500", badge: "bg-amber-500/10 text-amber-600" },
  DUE: { icon: Clock, color: "text-blue-500", badge: "bg-blue-500/10 text-blue-600" },
  OVERDUE: { icon: AlertTriangle, color: "text-red-500", badge: "bg-red-500/10 text-red-600" },
  ADVANCE: { icon: CheckCircle2, color: "text-purple-500", badge: "bg-purple-500/10 text-purple-600" },
};

export default function RentPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => { loadRent(); }, [selectedMonth]);

  async function loadRent() {
    setLoading(true);
    try {
      const res = await fetch(`/api/tenants?status=ACTIVE`);
      const data = await res.json();
      setTenants(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  const monthLabel = new Date(selectedMonth + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  const totalDue = tenants.reduce((s, t) => s + t.monthlyRent, 0);
  const totalPaid = tenants.reduce((s, t) => s + t.currentMonthPaid, 0);
  const totalOutstanding = tenants.reduce((s, t) => s + t.outstanding, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Rent Management</h1>
          <p className="text-sm text-muted-foreground">{monthLabel} — {tenants.length} tenants</p>
        </div>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="px-3 py-2 border rounded-lg bg-background text-sm"
        />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground">Total Rent Due</p>
          <p className="text-xl font-bold mt-1">{fmt(totalDue)}</p>
        </div>
        <div className="bg-card border rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground">Collected</p>
          <p className="text-xl font-bold mt-1 text-emerald-500">{fmt(totalPaid)}</p>
        </div>
        <div className="bg-card border rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground">Outstanding</p>
          <p className="text-xl font-bold mt-1 text-red-500">{fmt(totalOutstanding)}</p>
        </div>
      </div>

      {/* Rent Table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading…</div>
        ) : tenants.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No tenants with active assignments</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b bg-muted/50">
                  <th className="px-4 py-3 font-medium">Tenant</th>
                  <th className="px-4 py-3 font-medium">Bed</th>
                  <th className="px-4 py-3 font-medium">Rent</th>
                  <th className="px-4 py-3 font-medium">Paid</th>
                  <th className="px-4 py-3 font-medium">Remaining</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => {
                  const remaining = t.monthlyRent - t.currentMonthPaid;
                  const status = remaining <= 0 ? (t.currentMonthPaid > t.monthlyRent ? "ADVANCE" : "PAID") : t.currentMonthPaid > 0 ? "PARTIAL" : "DUE";
                  const config = STATUS_CONFIG[status] || STATUS_CONFIG.DUE;
                  return (
                    <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{t.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {t.roomNumber ? `Room ${t.roomNumber} · Bed ${t.bedNumber}` : "—"}
                      </td>
                      <td className="px-4 py-3">{fmt(t.monthlyRent)}</td>
                      <td className="px-4 py-3 font-medium text-emerald-500">{fmt(t.currentMonthPaid)}</td>
                      <td className={`px-4 py-3 font-medium ${remaining > 0 ? "text-red-500" : ""}`}>
                        {fmt(Math.max(0, remaining))}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.badge}`}>
                          <config.icon className="w-3 h-3" />
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
