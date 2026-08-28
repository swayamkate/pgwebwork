"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Phone, Mail, MoreHorizontal, Eye, CreditCard, LogOut, Download, User, Building2, IndianRupee, AlertTriangle } from "lucide-react";
import { exportTenantsToCSV } from "@/lib/export";
import { DropdownMenu } from "@/components/ui/dropdown-menu";

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  NOTICE_PERIOD: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  CHECKED_OUT: "bg-muted text-muted-foreground border-border",
  INACTIVE: "bg-red-500/10 text-red-500 border-red-500/20",
};

export default function TenantsPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const router = useRouter();

  const [form, setForm] = useState({ name: "", phone: "", email: "", emergencyContact: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { loadTenants(); }, [statusFilter]);

  async function loadTenants() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/tenants?${params}`);
      const data = await res.json();
      setTenants(data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setShowAdd(false);
      setForm({ name: "", phone: "", email: "", emergencyContact: "", notes: "" });
      loadTenants();
    } catch { setError("Failed to create tenant"); } finally { setSaving(false); }
  }

  const filtered = tenants.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return t.name.toLowerCase().includes(q) || t.phone?.toLowerCase().includes(q) || t.roomNumber?.toLowerCase().includes(q) || t.bedNumber?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Tenants</h1>
          <p className="text-sm text-muted-foreground">{tenants.length} total · {tenants.filter(t => t.status === "ACTIVE").length} active</p>
        </div>
        <DropdownMenu
          align="right"
          trigger={
            <button className="inline-flex items-center gap-2 px-3 py-2 border rounded-lg text-sm hover:bg-muted transition-colors">
              <MoreHorizontal className="w-4 h-4" /> Actions
            </button>
          }
          items={[
            { label: "Add Tenant", icon: <Plus className="w-4 h-4" />, onClick: () => setShowAdd(true) },
            { label: "Export CSV", icon: <Download className="w-4 h-4" />, onClick: () => exportTenantsToCSV(filtered) },
          ]}
        />
      </div>

      {/* ─── Filters (compact) ─── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, room…"
            className="w-full pl-9 pr-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border rounded-lg bg-background text-sm"
        >
          <option value="all">All</option>
          <option value="ACTIVE">Active</option>
          <option value="NOTICE_PERIOD">Notice</option>
          <option value="CHECKED_OUT">Checked Out</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>

      {/* ─── Table ─── */}
      <div className="bg-card border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {search ? "No tenants match" : "No tenants yet."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b bg-muted/50">
                  <th className="px-4 py-3 font-medium">Tenant</th>
                  <th className="px-4 py-3 font-medium">Bed</th>
                  <th className="px-4 py-3 font-medium">Rent</th>
                  <th className="px-4 py-3 font-medium">Outstanding</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30 group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                          {t.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()}
                        </div>
                        <button onClick={() => router.push(`/tenants/${t.id}`)} className="text-left hover:underline">
                          <span className="font-medium">{t.name}</span>
                          {t.email && <p className="text-xs text-muted-foreground">{t.email}</p>}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {t.roomNumber ? `R${t.roomNumber} · B${t.bedNumber}` : "—"}
                    </td>
                    <td className="px-4 py-3 font-medium">{fmt(t.monthlyRent)}</td>
                    <td className={`px-4 py-3 font-medium ${(t.outstanding || 0) > 0 ? "text-red-500" : "text-emerald-500"}`}>
                      {fmt(t.outstanding || 0)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[t.status] || ""}`}>
                        {t.status?.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <DropdownMenu
                        align="right"
                        trigger={
                          <button className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        }
                        items={[
                          { label: "View Profile", icon: <Eye className="w-4 h-4" />, onClick: () => router.push(`/tenants/${t.id}`) },
                          { label: "Record Payment", icon: <CreditCard className="w-4 h-4" />, onClick: () => router.push("/payments") },
                          { divider: true, label: "", onClick: () => {} },
                          { label: "Move Bed", icon: <Building2 className="w-4 h-4" />, onClick: () => router.push(`/tenants/${t.id}`) },
                          ...(t.status === "ACTIVE" ? [{ label: "Check Out", icon: <LogOut className="w-4 h-4" />, onClick: () => {}, danger: true }] : []),
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Add Tenant Modal ─── */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-card border rounded-xl w-full max-w-lg p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Add Tenant</h2>
            {error && <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg mb-4">{error}</div>}
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Full Name *</label>
                <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="e.g. Sakshi Hari Ram" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Phone</label>
                  <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Emergency Contact</label>
                <input type="text" value={form.emergencyContact} onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="text-sm font-medium">Notes</label>
                <textarea value={form.notes} rows={2} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm rounded-lg border hover:bg-muted">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50">
                  {saving ? "Saving…" : "Add Tenant"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
