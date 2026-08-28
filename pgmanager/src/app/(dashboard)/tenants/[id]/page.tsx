"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft, Phone, Mail, Calendar, IndianRupee, CreditCard,
  CheckCircle2, Clock, AlertTriangle, Minus, History, Receipt,
  MapPin, User, Edit2, LogOut, Tag, ChevronDown, ChevronRight,
} from "lucide-react";

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function daysSince(d: string | Date) {
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 30) return `${diff} days`;
  if (diff < 365) return `${Math.floor(diff / 30)} months`;
  return `${Math.floor(diff / 365)}y ${Math.floor((diff % 365) / 30)}m`;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  ACTIVE: { color: "text-emerald-500", bg: "bg-emerald-500/10", label: "Active" },
  NOTICE_PERIOD: { color: "text-amber-500", bg: "bg-amber-500/10", label: "Notice Period" },
  CHECKED_OUT: { color: "text-muted-foreground", bg: "bg-muted", label: "Checked Out" },
  INACTIVE: { color: "text-red-500", bg: "bg-red-500/10", label: "Inactive" },
};

const RENT_STATUS: Record<string, { icon: any; color: string; badge: string }> = {
  PAID: { icon: CheckCircle2, color: "text-emerald-500", badge: "bg-emerald-500/10 text-emerald-600" },
  ADVANCE: { icon: CheckCircle2, color: "text-purple-500", badge: "bg-purple-500/10 text-purple-600" },
  PARTIAL: { icon: Minus, color: "text-amber-500", badge: "bg-amber-500/10 text-amber-600" },
  DUE: { icon: Clock, color: "text-blue-500", badge: "bg-blue-500/10 text-blue-600" },
  OVERDUE: { icon: AlertTriangle, color: "text-red-500", badge: "bg-red-500/10 text-red-600" },
};

const PAYMENT_METHODS: Record<string, string> = {
  UPI: "bg-purple-500/10 text-purple-600",
  BANK_TRANSFER: "bg-blue-500/10 text-blue-600",
  CASH: "bg-emerald-500/10 text-emerald-600",
  CARD: "bg-amber-500/10 text-amber-600",
  CHEQUE: "bg-orange-500/10 text-orange-600",
  OTHER: "bg-muted text-muted-foreground",
};

export default function TenantHistoryPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [tenant, setTenant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "payments" | "rent" | "activity">("overview");

  useEffect(() => {
    if (id) {
      fetch(`/api/tenants/${id}`)
        .then((r) => r.json())
        .then(setTenant)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-muted rounded w-32" />
        <div className="h-40 bg-muted rounded-xl" />
        <div className="h-64 bg-muted rounded-xl" />
      </div>
    );
  }

  if (!tenant || tenant.error) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Tenant not found</p>
        <button onClick={() => router.push("/tenants")} className="mt-4 text-primary text-sm hover:underline">
          ← Back to tenants
        </button>
      </div>
    );
  }

  const summary = tenant._summary || {};
  const currentAssignment = tenant.assignments?.find((a: any) => a.isActive);
  const currentRR = currentAssignment?.rentRecords?.[0];
  const statusConfig = STATUS_CONFIG[tenant.status] || STATUS_CONFIG.ACTIVE;

  const tabs = [
    { id: "overview", label: "Overview", icon: User },
    { id: "payments", label: "Payments", icon: CreditCard, count: tenant.payments?.length || 0 },
    { id: "rent", label: "Rent Ledger", icon: IndianRupee },
    { id: "activity", label: "Activity", icon: History, count: tenant._auditLogs?.length || 0 },
  ] as const;

  return (
    <div className="space-y-6 max-w-[1200px]">
      {/* Back button */}
      <button onClick={() => router.push("/tenants")}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to tenants
      </button>

      {/* ─── Tenant Header ──────────────────────────────────────── */}
      <div className="bg-card border rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-5">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-xl font-bold text-primary shrink-0">
            {tenant.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()}
          </div>

          <div className="flex-1">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold">{tenant.name}</h1>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.color}`}>
                    {statusConfig.label}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-muted-foreground">
                  {currentAssignment && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      Room {currentAssignment.bed.room.number} · Bed {currentAssignment.bed.number}
                    </span>
                  )}
                  {tenant.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5" /> {tenant.phone}
                    </span>
                  )}
                  {tenant.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" /> {tenant.email}
                    </span>
                  )}
                  {currentAssignment?.joiningDate && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> Joined {fmtDate(currentAssignment.joiningDate)} · {daysSince(currentAssignment.joiningDate)}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => router.push("/payments")}
                  className="px-3 py-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-medium hover:bg-emerald-500/20">
                  + Record Payment
                </button>
                <button onClick={() => router.push("/receipts")}
                  className="px-3 py-1.5 border rounded-lg text-xs font-medium hover:bg-muted">
                  Receipts
                </button>
              </div>
            </div>

            {/* Aliases */}
            {tenant.aliases?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {tenant.aliases.map((a: any) => (
                  <span key={a.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-xs text-muted-foreground">
                    <Tag className="w-3 h-3" /> {a.alias}
                    {a.source && <span className="text-[10px] opacity-50">({a.source})</span>}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Financial Summary Cards ──────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-card border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Monthly Rent</p>
          <p className="text-xl font-bold mt-1">{fmt(summary.monthlyRent || 0)}</p>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Total Paid</p>
          <p className="text-xl font-bold mt-1 text-emerald-500">{fmt(summary.totalPaid || 0)}</p>
          <p className="text-[10px] text-muted-foreground">{summary.totalPayments || 0} payments</p>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Outstanding</p>
          <p className={`text-xl font-bold mt-1 ${(summary.outstanding || 0) > 0 ? "text-red-500" : "text-emerald-500"}`}>
            {fmt(summary.outstanding || 0)}
          </p>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Months Paid</p>
          <p className="text-xl font-bold mt-1">{summary.paidMonths || 0}/{summary.totalMonths || 0}</p>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Current Status</p>
          {currentRR ? (
            <div className="mt-1">
              {(() => {
                const rs = RENT_STATUS[currentRR.status] || RENT_STATUS.DUE;
                return (
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-medium ${rs.badge}`}>
                    <rs.icon className="w-4 h-4" /> {currentRR.status}
                  </span>
                );
              })()}
            </div>
          ) : (
            <p className="text-xl font-bold mt-1 text-muted-foreground">—</p>
          )}
        </div>
      </div>

      {/* ─── Tabs ──────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count !== undefined && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-muted">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ─── Tab Content ──────────────────────────────────────── */}

      {/* OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          {/* Personal details */}
          <div className="bg-card border rounded-xl p-5">
            <h3 className="font-semibold text-sm mb-3">Personal Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground">Full Name</label>
                <p className="text-sm font-medium">{tenant.name}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Phone</label>
                <p className="text-sm font-medium">{tenant.phone || "—"}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Email</label>
                <p className="text-sm font-medium">{tenant.email || "—"}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Emergency Contact</label>
                <p className="text-sm font-medium">{tenant.emergencyContact || "—"}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">ID Type</label>
                <p className="text-sm font-medium">{tenant.idType || "—"}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">ID Number</label>
                <p className="text-sm font-medium">{tenant.idNumber || "—"}</p>
              </div>
              {currentAssignment && (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground">Security Deposit</label>
                    <p className="text-sm font-medium">{currentAssignment.securityDeposit ? fmt(Number(currentAssignment.securityDeposit)) : "—"}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Rent Due Date</label>
                    <p className="text-sm font-medium">{currentAssignment.dueDate ? `Every ${currentAssignment.dueDate}${getOrdinal(currentAssignment.dueDate)}` : "—"}</p>
                  </div>
                </>
              )}
            </div>
            {tenant.notes && (
              <div className="mt-4 pt-3 border-t">
                <label className="text-xs text-muted-foreground">Notes</label>
                <p className="text-sm mt-1">{tenant.notes}</p>
              </div>
            )}
          </div>

          {/* Recent payments (top 5) */}
          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b flex items-center justify-between">
              <h3 className="font-semibold text-sm">Recent Payments</h3>
              <button onClick={() => setActiveTab("payments")} className="text-xs text-primary hover:underline">View all →</button>
            </div>
            {tenant.payments?.length > 0 ? (
              <div className="divide-y">
                {tenant.payments.slice(0, 5).map((p: any) => (
                  <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{fmt(Number(p.amount))}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.rentMonth} · {p.method?.replace("_", " ")} · {fmtDate(p.date)}
                      </p>
                    </div>
                    {p.receiptNumber && (
                      <span className="text-xs text-muted-foreground font-mono">{p.receiptNumber}</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-sm text-muted-foreground">No payments recorded yet</div>
            )}
          </div>
        </div>
      )}

      {/* PAYMENTS */}
      {activeTab === "payments" && (
        <div className="bg-card border rounded-xl overflow-hidden">
          {tenant.payments?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b bg-muted/50">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Month</th>
                    <th className="px-4 py-3 font-medium">Method</th>
                    <th className="px-4 py-3 font-medium">Receipt</th>
                    <th className="px-4 py-3 font-medium">Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {tenant.payments.map((p: any) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3">{fmtDate(p.date)}</td>
                      <td className="px-4 py-3 font-bold text-emerald-500">{fmt(Number(p.amount))}</td>
                      <td className="px-4 py-3">{p.rentMonth}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${PAYMENT_METHODS[p.method] || PAYMENT_METHODS.OTHER}`}>
                          {p.method?.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.receiptNumber || "—"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground truncate max-w-[150px]">{p.transactionId || p.bankReference || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">No payments recorded for this tenant</div>
          )}
        </div>
      )}

      {/* RENT LEDGER */}
      {activeTab === "rent" && (
        <div className="space-y-4">
          {currentAssignment?.rentRecords?.length > 0 ? (
            <>
              {/* Summary bar */}
              <div className="bg-card border rounded-xl p-4">
                <div className="flex flex-wrap gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Rent: </span>
                    <span className="font-bold">{fmt(summary.monthlyRent)}/mo</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Paid months: </span>
                    <span className="font-bold text-emerald-500">{summary.paidMonths}/{summary.totalMonths}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total due: </span>
                    <span className="font-bold">{fmt(summary.monthlyRent * summary.totalMonths)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total paid: </span>
                    <span className="font-bold text-emerald-500">{fmt(summary.totalPaid)}</span>
                  </div>
                </div>
              </div>

              {/* Month-by-month table */}
              <div className="bg-card border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b bg-muted/50">
                      <th className="px-4 py-3 font-medium">Month</th>
                      <th className="px-4 py-3 font-medium">Rent Due</th>
                      <th className="px-4 py-3 font-medium">Paid</th>
                      <th className="px-4 py-3 font-medium">Remaining</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentAssignment.rentRecords.map((rr: any) => {
                      const remaining = Number(rr.rentDue) - Number(rr.amountPaid);
                      const rs = RENT_STATUS[rr.status] || RENT_STATUS.DUE;
                      return (
                        <tr key={rr.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3 font-medium">{monthLabel(rr.month)}</td>
                          <td className="px-4 py-3">{fmt(Number(rr.rentDue))}</td>
                          <td className="px-4 py-3 font-medium text-emerald-500">{fmt(Number(rr.amountPaid))}</td>
                          <td className={`px-4 py-3 font-medium ${remaining > 0 ? "text-red-500" : ""}`}>
                            {remaining > 0 ? fmt(remaining) : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${rs.badge}`}>
                              <rs.icon className="w-3 h-3" /> {rr.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="bg-card border rounded-xl p-8 text-center text-muted-foreground">
              No rent records found for this tenant
            </div>
          )}
        </div>
      )}

      {/* ACTIVITY */}
      {activeTab === "activity" && (
        <div className="bg-card border rounded-xl overflow-hidden">
          {tenant._auditLogs?.length > 0 ? (
            <div className="divide-y">
              {tenant._auditLogs.map((log: any) => (
                <div key={log.id} className="flex items-start gap-3 px-5 py-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                    <History className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        log.action === "CREATE" ? "bg-emerald-500/10 text-emerald-600" :
                        log.action === "UPDATE" ? "bg-blue-500/10 text-blue-600" :
                        log.action === "DELETE" ? "bg-red-500/10 text-red-600" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {log.action}
                      </span>
                      <span className="text-xs text-muted-foreground">by {log.user}</span>
                    </div>
                    {log.newValue && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">{log.newValue}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(log.createdAt).toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">No activity recorded yet</div>
          )}
        </div>
      )}
    </div>
  );
}

// Helper functions
function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
