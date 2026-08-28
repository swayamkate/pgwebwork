"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  IndianRupee, Users, BedDouble, TrendingUp, TrendingDown, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Clock, CreditCard, Building2,
  Plus, Upload, CheckCircle2, ArrowRight, Wallet, Banknote,
  CircleDollarSign, Activity, Zap, ChevronRight, User,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, CartesianGrid,
} from "recharts";

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

function todayFormatted() {
  return new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-32 bg-muted rounded-xl" />)}
        </div>
        <div className="h-80 bg-muted rounded-xl" />
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

  const { occupancy: occ, financial: fin, rentStatus: rs, charts, tenantBreakdown, todayPayments, recentPayments, unmatchedTransactions, pgStartDate } = data;

  // Who owes money (top items needing attention)
  const whoOwes = tenantBreakdown?.filter((t: any) => t.remaining > 0).slice(0, 8) || [];
  const whoPaid = tenantBreakdown?.filter((t: any) => t.status === "PAID" || t.status === "ADVANCE").slice(0, 5) || [];

  // Collection efficiency
  const totalExpected = rs.total > 0 ? tenantBreakdown?.reduce((s: number, t: any) => s + t.monthlyRent, 0) : 0;
  const collectionEfficiency = totalExpected > 0 ? Math.round((fin.currentMonthCollection / totalExpected) * 100) : 0;

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* ─── Today's Header ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Today</p>
          <h1 className="text-2xl font-bold">{todayFormatted()}</h1>
          {pgStartDate && (
            <p className="text-xs text-muted-foreground mt-0.5">
              PG active since {new Date(pgStartDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
              {' · '}{(() => {
                const days = Math.floor((Date.now() - new Date(pgStartDate).getTime()) / (1000 * 60 * 60 * 24));
                if (days < 30) return `${days} days`;
                const months = Math.floor(days / 30);
                const yrs = Math.floor(months / 12);
                const rem = months % 12;
                return yrs > 0 ? `${yrs}y ${rem}m` : `${months} months`;
              })()}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => router.push("/payments")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-medium hover:bg-emerald-500/20 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Record Payment
          </button>
          <button onClick={() => router.push("/bank-import")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-medium hover:bg-primary/20 transition-colors">
            <Upload className="w-3.5 h-3.5" /> Import Statement
          </button>
        </div>
      </div>

      {/* ─── Today's Pulse ───────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-primary/5 via-emerald-500/5 to-transparent rounded-xl border p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${fin.todayCollection > 0 ? "bg-emerald-500/10" : "bg-muted"}`}>
              {fin.todayCollection > 0 ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              ) : (
                <Clock className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Collected today</p>
              <p className="text-xl font-bold">{fmt(fin.todayCollection)}</p>
            </div>
          </div>
          <div className="h-8 w-px bg-border hidden sm:block" />
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${todayPayments?.length > 0 ? "bg-blue-500/10" : "bg-muted"}`}>
              <CreditCard className={`w-5 h-5 ${todayPayments?.length > 0 ? "text-blue-500" : "text-muted-foreground"}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Payments today</p>
              <p className="text-xl font-bold">{todayPayments?.length || 0}</p>
            </div>
          </div>
          {unmatchedTransactions > 0 && (
            <>
              <div className="h-8 w-px bg-border hidden sm:block" />
              <button onClick={() => router.push("/bank-import")}
                className="flex items-center gap-3 hover:bg-background/50 rounded-lg px-2 py-1 -mx-2 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Unmatched</p>
                  <p className="text-xl font-bold text-amber-500">{unmatchedTransactions}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* ─── Core Numbers (4 big cards) ──────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Collected this month */}
        <div className="bg-card border rounded-xl p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-full -translate-y-6 translate-x-6" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <IndianRupee className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <p className="text-xs text-muted-foreground">Collected</p>
            </div>
            <p className="text-2xl font-bold text-emerald-500">{fmt(fin.currentMonthCollection)}</p>
            <p className="text-xs text-muted-foreground mt-1">{collectionEfficiency}% of expected</p>
          </div>
        </div>

        {/* Pending */}
        <div className="bg-card border rounded-xl p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/5 rounded-full -translate-y-6 translate-x-6" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
            <p className="text-2xl font-bold text-amber-500">{fmt(fin.pendingRent)}</p>
            <p className="text-xs text-muted-foreground mt-1">{rs.due} tenants due</p>
          </div>
        </div>

        {/* Overdue */}
        <div className={`bg-card border rounded-xl p-4 relative overflow-hidden ${fin.overdueRent > 0 ? "border-red-500/30" : ""}`}>
          <div className={`absolute top-0 right-0 w-20 h-20 rounded-full -translate-y-6 translate-x-6 ${fin.overdueRent > 0 ? "bg-red-500/5" : "bg-muted/50"}`} />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${fin.overdueRent > 0 ? "bg-red-500/10" : "bg-muted"}`}>
                <AlertTriangle className={`w-3.5 h-3.5 ${fin.overdueRent > 0 ? "text-red-500" : "text-muted-foreground"}`} />
              </div>
              <p className="text-xs text-muted-foreground">Overdue</p>
            </div>
            <p className={`text-2xl font-bold ${fin.overdueRent > 0 ? "text-red-500" : "text-muted-foreground"}`}>{fmt(fin.overdueRent)}</p>
            <p className="text-xs text-muted-foreground mt-1">{rs.overdue} overdue</p>
          </div>
        </div>

        {/* Net Income */}
        <div className="bg-card border rounded-xl p-4 relative overflow-hidden">
          <div className={`absolute top-0 right-0 w-20 h-20 rounded-full -translate-y-6 translate-x-6 ${fin.netIncome >= 0 ? "bg-blue-500/5" : "bg-red-500/5"}`} />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${fin.netIncome >= 0 ? "bg-blue-500/10" : "bg-red-500/10"}`}>
                <TrendingUp className={`w-3.5 h-3.5 ${fin.netIncome >= 0 ? "text-blue-500" : "text-red-500"}`} />
              </div>
              <p className="text-xs text-muted-foreground">Net Income</p>
            </div>
            <p className={`text-2xl font-bold ${fin.netIncome >= 0 ? "text-blue-500" : "text-red-500"}`}>{fmt(fin.netIncome)}</p>
            <p className="text-xs text-muted-foreground mt-1">This month: {fmt(fin.currentMonthNet)}</p>
          </div>
        </div>
      </div>

      {/* ─── Collection Progress + Rent Status ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Collection progress (the most important visual) */}
        <div className="lg:col-span-2 bg-card border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-sm">Collection Progress</h2>
              <p className="text-xs text-muted-foreground mt-0.5">This month's rent collection status</p>
            </div>
            <span className="text-2xl font-bold text-primary">{collectionEfficiency}%</span>
          </div>

          {/* Progress bar */}
          <div className="relative">
            <div className="w-full h-6 bg-muted rounded-full overflow-hidden flex">
              {rs.paid > 0 && (
                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(rs.paid / rs.total) * 100}%` }} />
              )}
              {rs.partial > 0 && (
                <div className="h-full bg-amber-500 transition-all" style={{ width: `${(rs.partial / rs.total) * 100}%` }} />
              )}
              {rs.due > 0 && (
                <div className="h-full bg-blue-500/50 transition-all" style={{ width: `${(rs.due / rs.total) * 100}%` }} />
              )}
              {rs.overdue > 0 && (
                <div className="h-full bg-red-500 transition-all" style={{ width: `${(rs.overdue / rs.total) * 100}%` }} />
              )}
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-3">
            {[
              { label: "Paid", count: rs.paid, color: "bg-emerald-500" },
              { label: "Partial", count: rs.partial, color: "bg-amber-500" },
              { label: "Due", count: rs.due, color: "bg-blue-500/50" },
              { label: "Overdue", count: rs.overdue, color: "bg-red-500" },
            ].filter(l => l.count > 0).map(l => (
              <div key={l.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className={`w-2.5 h-2.5 rounded-sm ${l.color}`} />
                {l.label}: {l.count}
              </div>
            ))}
          </div>

          {/* Money breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t">
            <div>
              <p className="text-xs text-muted-foreground">Expected</p>
              <p className="text-sm font-bold">{fmt(totalExpected)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Collected</p>
              <p className="text-sm font-bold text-emerald-500">{fmt(fin.currentMonthCollection)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Remaining</p>
              <p className="text-sm font-bold text-amber-500">{fmt(fin.pendingRent)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Overdue</p>
              <p className="text-sm font-bold text-red-500">{fmt(fin.overdueRent)}</p>
            </div>
          </div>
        </div>

        {/* Occupancy card */}
        <div className="bg-card border rounded-xl p-5">
          <h2 className="font-semibold text-sm mb-4">Occupancy</h2>

          {/* Circular occupancy */}
          <div className="relative w-32 h-32 mx-auto mb-4">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(var(--muted))" strokeWidth="12" />
              <circle
                cx="60" cy="60" r="50" fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="12"
                strokeDasharray={`${occ.occupancyRate * 3.14} 314`}
                strokeLinecap="round"
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-2xl font-bold">{occ.occupancyRate}%</p>
              <p className="text-xs text-muted-foreground">occupied</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center p-2 bg-emerald-500/5 rounded-lg">
              <span className="text-xs flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500" /> Occupied
              </span>
              <span className="text-sm font-bold">{occ.occupiedBeds}</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-muted/50 rounded-lg">
              <span className="text-xs flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-muted-foreground/30" /> Vacant
              </span>
              <span className="text-sm font-bold">{occ.vacantBeds}</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-background rounded-lg">
              <span className="text-xs flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-primary" /> Total Beds
              </span>
              <span className="text-sm font-bold">{occ.totalBeds}</span>
            </div>
          </div>

          <button onClick={() => router.push("/rooms")}
            className="w-full mt-3 py-2 text-xs text-muted-foreground hover:text-foreground border rounded-lg hover:bg-muted transition-colors">
            View all rooms →
          </button>
        </div>
      </div>

      {/* ─── Who Owes Money (actionable!) ──────────────────────── */}
      {whoOwes.length > 0 && (
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center">
                <CircleDollarSign className="w-4 h-4 text-red-500" />
              </div>
              <div>
                <h2 className="font-semibold text-sm">Who Owes Rent</h2>
                <p className="text-xs text-muted-foreground">{whoOwes.length} tenant{whoOwes.length !== 1 ? "s" : ""} with pending payments</p>
              </div>
            </div>
            <button onClick={() => router.push("/rent")}
              className="text-xs text-primary hover:underline">View all →</button>
          </div>
          <div className="divide-y">
            {whoOwes.map((t: any) => (
              <div key={t.tenantId} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {t.tenantName.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{t.tenantName}</p>
                    {t.status === "OVERDUE" && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-500">OVERDUE</span>
                    )}
                    {t.status === "PARTIAL" && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-500">PARTIAL</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Room {t.roomNumber} · Bed {t.bedNumber} · {fmt(t.monthlyRent)}/mo</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-red-500">{fmt(t.remaining)}</p>
                  <p className="text-[10px] text-muted-foreground">{fmt(t.paid)} paid</p>
                </div>
                <button onClick={() => router.push(`/payments`)}
                  className="shrink-0 px-2.5 py-1 text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-md hover:bg-emerald-500/20 transition-colors">
                  Pay
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Charts Row ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monthly trend chart */}
        <div className="lg:col-span-2 bg-card border rounded-xl p-5">
          <h2 className="font-semibold text-sm mb-4">Monthly Trend</h2>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={charts.monthlyRevenue}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} width={60} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value: number) => fmt(value)}
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
              <Area type="monotone" dataKey="expenses" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorExpenses)" />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-3 h-1 rounded bg-emerald-500" /> Revenue
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-3 h-1 rounded bg-amber-500" /> Expenses
            </div>
          </div>
        </div>

        {/* Recent activity */}
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b">
            <h2 className="font-semibold text-sm">Recent Payments</h2>
          </div>
          {recentPayments?.length > 0 ? (
            <div className="divide-y max-h-[300px] overflow-y-auto">
              {recentPayments.map((p: any) => (
                <div key={p.id} className="flex items-center gap-3 px-5 py-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{p.tenantName}</p>
                    <p className="text-[10px] text-muted-foreground">Room {p.roomNumber} · {p.method?.replace("_", " ")}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-emerald-500">+{fmt(p.amount)}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(p.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No payments recorded yet
            </div>
          )}
          {recentPayments?.length > 0 && (
            <div className="border-t">
              <button onClick={() => router.push("/payments")}
                className="w-full py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                View all payments →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── Quick Actions ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Record Payment", icon: IndianRupee, href: "/payments", color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Add Tenant", icon: Users, href: "/tenants", color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "Import Bank Data", icon: Upload, href: "/bank-import", color: "text-purple-500", bg: "bg-purple-500/10" },
          { label: "View Reports", icon: TrendingUp, href: "/reports", color: "text-amber-500", bg: "bg-amber-500/10" },
        ].map(action => (
          <button key={action.label} onClick={() => router.push(action.href)}
            className="flex items-center gap-3 p-4 bg-card border rounded-xl hover:bg-muted/50 hover:border-primary/30 transition-all group">
            <div className={`w-10 h-10 rounded-xl ${action.bg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
              <action.icon className={`w-5 h-5 ${action.color}`} />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium">{action.label}</p>
              <ChevronRight className="w-3 h-3 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
