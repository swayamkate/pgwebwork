"use client";

import { useState, useEffect } from "react";
import {
  IndianRupee, Users, BedDouble, TrendingUp, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Clock, CreditCard, Building2,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid,
} from "recharts";

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

const COLORS = ["#22c55e", "#f59e0b", "#ef4444", "#6366f1", "#8b5cf6"];

export default function DashboardPage() {
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
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading dashboard…</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>Could not load dashboard data.</p>
      </div>
    );
  }

  const { occupancy: occ, financial: fin, rentStatus: rs, charts, unmatchedTransactions } = data;

  const statCards = [
    { label: "Total Collection", value: fmt(fin.totalCollection), note: `This month: ${fmt(fin.currentMonthCollection)}`, icon: IndianRupee, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "Today's Collection", value: fmt(fin.todayCollection), note: "Payments received today", icon: CreditCard, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Pending Rent", value: fmt(fin.pendingRent), note: `${rs.due} due this month`, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Overdue", value: fmt(fin.overdueRent), note: `${rs.overdue} overdue`, icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/10" },
    { label: "Expenses", value: fmt(fin.totalExpenses), note: `This month: ${fmt(fin.currentMonthExpenses)}`, icon: ArrowDownRight, color: "text-orange-500", bg: "bg-orange-500/10" },
    { label: "Net Income", value: fmt(fin.netIncome), note: `This month: ${fmt(fin.currentMonthNet)}`, icon: TrendingUp, color: fin.netIncome >= 0 ? "text-emerald-500" : "text-red-500", bg: fin.netIncome >= 0 ? "bg-emerald-500/10" : "bg-red-500/10" },
  ];

  const occCards = [
    { label: "Total Rooms", value: occ.totalRooms },
    { label: "Total Beds", value: occ.totalBeds },
    { label: "Occupied", value: occ.occupiedBeds },
    { label: "Vacant", value: occ.vacantBeds },
    { label: "Occupancy", value: `${occ.occupancyRate}%` },
  ];

  const rentPieData = [
    { name: "Paid", value: rs.paid },
    { name: "Partial", value: rs.partial },
    { name: "Due", value: rs.due },
    { name: "Overdue", value: rs.overdue },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Financial overview of your property</p>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="bg-card border rounded-xl p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{card.label}</p>
                <p className="text-2xl font-bold mt-1">{card.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{card.note}</p>
              </div>
              <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monthly Revenue Chart */}
        <div className="lg:col-span-2 bg-card border rounded-xl p-4">
          <h2 className="font-semibold text-sm mb-4">Monthly Revenue vs Expenses</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={charts.monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value: number) => fmt(value)}
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
              />
              <Legend />
              <Bar dataKey="revenue" name="Revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Rent Status Pie */}
        <div className="bg-card border rounded-xl p-4">
          <h2 className="font-semibold text-sm mb-4">Rent Status</h2>
          {rentPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={rentPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {rentPieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
              No rent records yet
            </div>
          )}
        </div>
      </div>

      {/* Occupancy & Alerts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Occupancy */}
        <div className="bg-card border rounded-xl p-4">
          <h2 className="font-semibold text-sm mb-4 flex items-center gap-2">
            <Building2 className="w-4 h-4" /> Occupancy
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {occCards.map((c) => (
              <div key={c.label} className="text-center p-3 bg-background rounded-lg">
                <p className="text-2xl font-bold">{c.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{c.label}</p>
              </div>
            ))}
          </div>
          {/* Occupancy bar */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>{occ.occupiedBeds} occupied</span>
              <span>{occ.occupancyRate}%</span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${occ.occupancyRate}%` }}
              />
            </div>
          </div>
        </div>

        {/* Alerts */}
        <div className="bg-card border rounded-xl p-4">
          <h2 className="font-semibold text-sm mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Alerts
          </h2>
          <div className="space-y-3">
            {rs.overdue > 0 && (
              <div className="flex items-center gap-3 p-3 bg-red-500/10 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">{rs.overdue} overdue rent{rs.overdue > 1 ? "s" : ""}</p>
                  <p className="text-xs text-muted-foreground">{fmt(fin.overdueRent)} outstanding</p>
                </div>
              </div>
            )}
            {rs.due > 0 && (
              <div className="flex items-center gap-3 p-3 bg-amber-500/10 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">{rs.due} rent{rs.due > 1 ? "s" : ""} due</p>
                  <p className="text-xs text-muted-foreground">{fmt(fin.pendingRent)} pending</p>
                </div>
              </div>
            )}
            {unmatchedTransactions > 0 && (
              <div className="flex items-center gap-3 p-3 bg-blue-500/10 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">{unmatchedTransactions} unmatched transactions</p>
                  <p className="text-xs text-muted-foreground">Import bank statements to match</p>
                </div>
              </div>
            )}
            {rs.overdue === 0 && rs.due === 0 && unmatchedTransactions === 0 && (
              <div className="flex items-center gap-3 p-3 bg-emerald-500/10 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">All clear!</p>
                  <p className="text-xs text-muted-foreground">No overdue payments or alerts</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Payments */}
      {data.recentPayments?.length > 0 && (
        <div className="bg-card border rounded-xl p-4">
          <h2 className="font-semibold text-sm mb-4">Recent Payments</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b">
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Amount</th>
                  <th className="pb-2 font-medium">Method</th>
                  <th className="pb-2 font-medium">Month</th>
                </tr>
              </thead>
              <tbody>
                {data.recentPayments.map((p: any) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-2">{new Date(p.date).toLocaleDateString("en-IN")}</td>
                    <td className="py-2 font-medium">{fmt(p.amount)}</td>
                    <td className="py-2 text-muted-foreground">{p.method}</td>
                    <td className="py-2 text-muted-foreground">{p.rentMonth}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
