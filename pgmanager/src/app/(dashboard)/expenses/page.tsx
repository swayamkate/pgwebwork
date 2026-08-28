"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, IndianRupee, Download } from "lucide-react";
import { exportExpensesToCSV } from "@/lib/export";

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

const CATEGORIES = [
  "ELECTRICITY", "WATER", "INTERNET", "MAINTENANCE", "CLEANING",
  "REPAIRS", "SALARY", "RENT", "SUPPLIES", "OTHER",
];

const CAT_BADGES: Record<string, string> = {
  ELECTRICITY: "bg-yellow-500/10 text-yellow-600",
  WATER: "bg-blue-500/10 text-blue-600",
  INTERNET: "bg-cyan-500/10 text-cyan-600",
  MAINTENANCE: "bg-orange-500/10 text-orange-600",
  CLEANING: "bg-emerald-500/10 text-emerald-600",
  REPAIRS: "bg-red-500/10 text-red-600",
  SALARY: "bg-purple-500/10 text-purple-600",
  RENT: "bg-amber-500/10 text-amber-600",
  SUPPLIES: "bg-pink-500/10 text-pink-600",
  OTHER: "bg-muted text-muted-foreground",
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ category: "OTHER", description: "", amount: "", method: "BANK_TRANSFER", vendor: "", date: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [catFilter, setCatFilter] = useState("");

  useEffect(() => { loadExpenses(); }, [catFilter]);

  async function loadExpenses() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (catFilter) params.set("category", catFilter);
      const res = await fetch(`/api/expenses?${params}`);
      setExpenses(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setShowAdd(false);
      setForm({ category: "OTHER", description: "", amount: "", method: "BANK_TRANSFER", vendor: "", date: "", notes: "" });
      loadExpenses();
    } catch { setError("Failed to create expense"); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this expense?")) return;
    try {
      await fetch(`/api/expenses?id=${id}`, { method: "DELETE" });
      loadExpenses();
    } catch (e) { console.error(e); }
  }

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  // Category breakdown
  const byCat: Record<string, number> = {};
  expenses.forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + e.amount; });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Expenses</h1>
          <p className="text-sm text-muted-foreground">{expenses.length} expenses · {fmt(total)} total</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportExpensesToCSV(expenses)}
            className="inline-flex items-center gap-2 px-3 py-2 border rounded-lg text-sm text-muted-foreground hover:bg-muted">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
            <Plus className="w-4 h-4" /> Add Expense
          </button>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(byCat)
          .sort(([, a], [, b]) => b - a)
          .map(([cat, amt]) => (
            <button key={cat} onClick={() => setCatFilter(catFilter === cat ? "" : cat)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                catFilter === cat ? "bg-primary/10 border-primary/30 text-primary" : "bg-card hover:bg-muted"
              }`}>
              {cat.replace("_", " ")} · {fmt(amt)}
            </button>
          ))}
      </div>

      {/* Table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading…</div>
        ) : expenses.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No expenses recorded yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b bg-muted/50">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Vendor</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">{new Date(e.date).toLocaleDateString("en-IN")}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${CAT_BADGES[e.category] || CAT_BADGES.OTHER}`}>
                        {e.category?.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">{e.description}</td>
                    <td className="px-4 py-3 font-medium text-red-500">{fmt(e.amount)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{e.vendor || "—"}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleDelete(e.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-card border rounded-xl w-full max-w-lg p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Add Expense</h2>
            {error && <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg mb-4">{error}</div>}
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Category *</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg bg-background text-sm">
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Amount (₹) *</label>
                  <input type="number" required min="1" value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg bg-background text-sm" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Description *</label>
                <input type="text" required value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border rounded-lg bg-background text-sm"
                  placeholder="e.g. August electricity bill" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Vendor</label>
                  <input type="text" value={form.vendor}
                    onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg bg-background text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium">Date</label>
                  <input type="date" value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg bg-background text-sm" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm rounded-lg border hover:bg-muted">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50">
                  {saving ? "Saving…" : "Add Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
