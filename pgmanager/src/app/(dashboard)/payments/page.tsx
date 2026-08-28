"use client";

import { useState, useEffect } from "react";
import { Search, Plus, ArrowDownUp, Receipt } from "lucide-react";

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

const METHOD_BADGES: Record<string, string> = {
  UPI: "bg-purple-500/10 text-purple-600",
  BANK_TRANSFER: "bg-blue-500/10 text-blue-600",
  CASH: "bg-emerald-500/10 text-emerald-600",
  CARD: "bg-amber-500/10 text-amber-600",
  CHEQUE: "bg-orange-500/10 text-orange-600",
  OTHER: "bg-muted text-muted-foreground",
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ tenantId: "", amount: "", method: "BANK_TRANSFER", rentMonth: "", date: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { loadPayments(); loadTenants(); }, [methodFilter]);

  async function loadPayments() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (methodFilter) params.set("method", methodFilter);
      const res = await fetch(`/api/payments?${params}`);
      setPayments(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function loadTenants() {
    try {
      const res = await fetch("/api/tenants?status=ACTIVE");
      setTenants(await res.json());
    } catch (e) { console.error(e); }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setShowAdd(false);
      setForm({ tenantId: "", amount: "", method: "BANK_TRANSFER", rentMonth: "", date: "", notes: "" });
      loadPayments();
    } catch { setError("Failed to create payment"); }
    finally { setSaving(false); }
  }

  const currentMonth = new Date().toISOString().slice(0, 7);

  const filtered = payments.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.tenantName?.toLowerCase().includes(q) || p.receiptNumber?.toLowerCase().includes(q) || p.transactionId?.toLowerCase().includes(q);
  });

  const totalFiltered = filtered.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Payments</h1>
          <p className="text-sm text-muted-foreground">{payments.length} payments · {fmt(totalFiltered)} total</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" /> Record Payment
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by tenant, receipt, transaction…"
            className="w-full pl-9 pr-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} className="px-3 py-2 border rounded-lg bg-background text-sm">
          <option value="">All Methods</option>
          <option value="UPI">UPI</option>
          <option value="BANK_TRANSFER">Bank Transfer</option>
          <option value="CASH">Cash</option>
          <option value="CARD">Card</option>
          <option value="CHEQUE">Cheque</option>
        </select>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No payments found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b bg-muted/50">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Tenant</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Method</th>
                  <th className="px-4 py-3 font-medium">Month</th>
                  <th className="px-4 py-3 font-medium">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">{new Date(p.date).toLocaleDateString("en-IN")}</td>
                    <td className="px-4 py-3 font-medium">{p.tenantName}</td>
                    <td className="px-4 py-3 font-medium">{fmt(p.amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${METHOD_BADGES[p.method] || METHOD_BADGES.OTHER}`}>
                        {p.method?.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{p.rentMonth}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{p.receiptNumber || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Payment Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-card border rounded-xl w-full max-w-lg p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Record Payment</h2>
            {error && <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg mb-4">{error}</div>}
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Tenant *</label>
                <select required value={form.tenantId} onChange={(e) => setForm({ ...form, tenantId: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="">Select tenant</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} — Room {t.roomNumber || "?"} · Bed {t.bedNumber || "?"}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Amount (₹) *</label>
                  <input type="number" required min="1" value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="text-sm font-medium">Rent Month *</label>
                  <input type="month" required value={form.rentMonth || currentMonth}
                    onChange={(e) => setForm({ ...form, rentMonth: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Payment Method</label>
                  <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg bg-background text-sm">
                    <option value="UPI">UPI</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CASH">Cash</option>
                    <option value="CARD">Card</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Date</label>
                  <input type="date" value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg bg-background text-sm" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Notes</label>
                <textarea value={form.notes} rows={2}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border rounded-lg bg-background text-sm" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm rounded-lg border hover:bg-muted">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50">
                  {saving ? "Saving…" : "Record Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
