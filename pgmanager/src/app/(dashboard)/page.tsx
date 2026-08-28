"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  IndianRupee, Users, BedDouble, TrendingUp, AlertTriangle,
  CreditCard, Building2, Plus, Upload, CheckCircle2, Clock,
  CircleDollarSign, ChevronRight,
} from "lucide-react";

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-muted rounded w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-muted rounded-xl" />)}
        </div>
        <div className="h-64 bg-muted rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-muted mb-4">
          <Building2 className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-bold">Welcome to PG Manager</h2>
        <p className="text-muted-foreground mt-1 mb-4">Set up your property to get started</p>
        <button onClick={() => router.push("/rooms")}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
          Add your first room
        </button>
      </div>
    );
  }

  const { occupancy: occ, financial: fin, rentStatus: rs, tenantBreakdown, unmatchedTransactions } = data;

  const whoOwes = tenantBreakdown?.filter((t: any) => t.remaining > 0) || [];
  const totalExpected = tenantBreakdown?.reduce((s: number, t: any) => s + t.monthlyRent, 0) || 0;
  const collectionRate = totalExpected > 0 ? Math.round((fin.currentMonthCollection / totalExpected) * 100) : 0;

  return (
    <div className="space-y-4 max-w-[1200px]">

      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Dashboard</h1>
          <p className="text-xs text-muted-foreground">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => router.push("/payments")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-medium hover:bg-emerald-500/20 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Record Payment
          </button>
          <button onClick={() => router.push("/bank-import")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-medium hover:bg-primary/20 transition-colors">
            <Upload className="w-3.5 h-3.5" /> Import
          </button>
        </div>
      </div>

      {/* ─── Today Strip ─── */}
      {(fin.todayCollection > 0 || unmatchedTransactions > 0) && (
        <div className="flex items-center gap-4 px-4 py-2.5 bg-emerald-500/5 border border-emerald-500/10 rounded-lg text-xs">
          {fin.todayCollection > 0 && (
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> Today: {fmt(fin.todayCollection)}
            </span>
          )}
          {data.todayPayments?.length > 0 && (
            <span className="text-muted-foreground">
              {data.todayPayments.length} payment{data.todayPayments.length > 1 ? "s" : ""}
            </span>
          )}
          {unmatchedTransactions > 0 && (
            <button onClick={() => router.push("/bank-import")}
              className="flex items-center gap-1 text-amber-500 hover:underline ml-auto">
              <AlertTriangle className="w-3.5 h-3.5" /> {unmatchedTransactions} unmatched
            </button>
          )}
        </div>
      )}

      {/* ─── Core Numbers ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button onClick={() => router.push("/rent")}
          className="bg-card border rounded-xl p-4 text-left hover:border-primary/30 transition-colors group">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-6 h-6 rounded-md bg-emerald-500/10 flex items-center justify-center">
              <IndianRupee className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <span className="text-xs text-muted-foreground">Collected</span>
          </div>
          <p className="text-xl font-bold text-emerald-500">{fmt(fin.currentMonthCollection)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{collectionRate}% collected</p>
        </button>

        <button onClick={() => router.push("/rent")}
          className="bg-card border rounded-xl p-4 text-left hover:border-primary/30 transition-colors group">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-6 h-6 rounded-md bg-amber-500/10 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <span className="text-xs text-muted-foreground">Pending</span>
          </div>
          <p className="text-xl font-bold text-amber-500">{fmt(fin.pendingRent)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{rs.due + rs.partial} tenants</p>
        </button>

        <button onClick={() => router.push("/rent")}
          className={`bg-card border rounded-xl p-4 text-left hover:border-primary/30 transition-colors ${fin.overdueRent > 0 ? "border-red-500/20" : ""}`}>
          <div className="flex items-center gap-2 mb-1.5">
            <div className={`w-6 h-6 rounded-md ${fin.overdueRent > 0 ? "bg-red-500/10" : "bg-muted"}`}>
              <AlertTriangle className={`w-3.5 h-3.5 ${fin.overdueRent > 0 ? "text-red-500" : "text-muted-foreground"}`} />
            </div>
            <span className="text-xs text-muted-foreground">Overdue</span>
          </div>
          <p className={`text-xl font-bold ${fin.overdueRent > 0 ? "text-red-500" : "text-muted-foreground"}`}>{fmt(fin.overdueRent)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{rs.overdue} overdue</p>
        </button>

        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <div className={`w-6 h-6 rounded-md ${fin.netIncome >= 0 ? "bg-blue-500/10" : "bg-red-500/10"}`}>
              <TrendingUp className={`w-3.5 h-3.5 ${fin.netIncome >= 0 ? "text-blue-500" : "text-red-500"}`} />
            </div>
            <span className="text-xs text-muted-foreground">Net Income</span>
          </div>
          <p className={`text-xl font-bold ${fin.netIncome >= 0 ? "text-blue-500" : "text-red-500"}`}>{fmt(fin.netIncome)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Revenue − Expenses</p>
        </div>
      </div>

      {/* ─── Who Owes + Occupancy ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Who Owes Rent */}
        <div className="lg:col-span-2 bg-card border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="flex items-center gap-2">
              <CircleDollarSign className="w-4 h-4 text-red-500" />
              <span className="text-sm font-semibold">Rent Due</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-muted font-medium">
                {whoOwes.length}
              </span>
            </div>
            <button onClick={() => router.push("/rent")} className="text-xs text-primary hover:underline">
              All →
            </button>
          </div>

          {whoOwes.length > 0 ? (
            <div className="divide-y max-h-[320px] overflow-y-auto">
              {whoOwes.map((t: any) => (
                <div key={t.tenantId} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                    {t.tenantName.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => router.push(`/tenants/${t.tenantId}`)}
                        className="text-sm font-medium truncate hover:underline text-left">
                        {t.tenantName}
                      </button>
                      {t.status === "OVERDUE" && (
                        <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-red-500/10 text-red-500">LATE</span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">R{t.roomNumber} · B{t.bedNumber}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-red-500">{fmt(t.remaining)}</p>
                  </div>
                  <button onClick={() => router.push("/payments")}
                    className="shrink-0 px-2 py-1 text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded hover:bg-emerald-500/20 transition-colors">
                    Pay
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">All paid up! 🎉</p>
            </div>
          )}
        </div>

        {/* Occupancy (compact) */}
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold">Occupancy</span>
            <button onClick={() => router.push("/rooms")} className="text-xs text-primary hover:underline">
              Rooms →
            </button>
          </div>

          {/* Progress ring */}
          <div className="relative w-24 h-24 mx-auto mb-3">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="40" fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="8"
                strokeDasharray={`${(occ.occupancyRate / 100) * 251} 251`}
                strokeLinecap="round"
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-lg font-bold">{occ.occupancyRate}%</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center px-2 py-1.5 bg-emerald-500/5 rounded-md">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Occupied
              </span>
              <span className="text-xs font-bold">{occ.occupiedBeds}</span>
            </div>
            <div className="flex justify-between items-center px-2 py-1.5 bg-muted/30 rounded-md">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-muted-foreground/30" /> Vacant
              </span>
              <span className="text-xs font-bold">{occ.vacantBeds}</span>
            </div>
          </div>

          {/* Payment status mini bars */}
          <div className="mt-3 pt-3 border-t">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">This Month</p>
            <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-muted">
              {rs.paid > 0 && <div className="bg-emerald-500 rounded-l-full" style={{ width: `${(rs.paid / rs.total) * 100}%` }} />}
              {rs.partial > 0 && <div className="bg-amber-500" style={{ width: `${(rs.partial / rs.total) * 100}%` }} />}
              {rs.due > 0 && <div className="bg-blue-500/50" style={{ width: `${(rs.due / rs.total) * 100}%` }} />}
              {rs.overdue > 0 && <div className="bg-red-500 rounded-r-full" style={{ width: `${(rs.overdue / rs.total) * 100}%` }} />}
            </div>
            <div className="flex gap-3 mt-1.5">
              {rs.paid > 0 && <span className="text-[9px] text-emerald-500">✓ {rs.paid}</span>}
              {rs.partial > 0 && <span className="text-[9px] text-amber-500">◐ {rs.partial}</span>}
              {rs.due > 0 && <span className="text-[9px] text-blue-500">● {rs.due}</span>}
              {rs.overdue > 0 && <span className="text-[9px] text-red-500">! {rs.overdue}</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
