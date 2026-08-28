"use client";

import { useState, useEffect } from "react";
import { Plus, BedDouble, User, IndianRupee, Trash2 } from "lucide-react";

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

const STATUS_STYLES: Record<string, { bg: string; border: string; badge: string; label: string }> = {
  PAID: { bg: "bg-emerald-500/5", border: "border-emerald-500/20", badge: "bg-emerald-500/10 text-emerald-600", label: "PAID" },
  PARTIAL: { bg: "bg-amber-500/5", border: "border-amber-500/20", badge: "bg-amber-500/10 text-amber-600", label: "PARTIAL" },
  DUE: { bg: "bg-blue-500/5", border: "border-blue-500/20", badge: "bg-blue-500/10 text-blue-600", label: "DUE" },
  OVERDUE: { bg: "bg-red-500/5", border: "border-red-500/20", badge: "bg-red-500/10 text-red-600", label: "OVERDUE" },
};

export default function RoomsPage() {
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ number: "", floor: "0", bedCount: "2", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { loadRooms(); }, []);

  async function loadRooms() {
    setLoading(true);
    try {
      const res = await fetch("/api/rooms");
      setRooms(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setShowAdd(false);
      setForm({ number: "", floor: "0", bedCount: "2", notes: "" });
      loadRooms();
    } catch { setError("Failed to create room"); }
    finally { setSaving(false); }
  }

  const totalBeds = rooms.reduce((s, r) => s + r.totalBeds, 0);
  const occupiedBeds = rooms.reduce((s, r) => s + r.occupiedBeds, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Rooms & Beds</h1>
          <p className="text-sm text-muted-foreground">
            {rooms.length} rooms · {occupiedBeds}/{totalBeds} beds occupied
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" /> Add Room
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading…</div>
      ) : rooms.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <BedDouble className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No rooms yet</p>
          <p className="text-sm mt-1">Add your first room to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map((room) => (
            <div key={room.id} className="bg-card border rounded-xl overflow-hidden">
              {/* Room header */}
              <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
                <div>
                  <h3 className="font-semibold">Room {room.number}</h3>
                  <p className="text-xs text-muted-foreground">Floor {room.floor} · {room.occupiedBeds}/{room.totalBeds} occupied</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <BedDouble className="w-4 h-4 text-primary" />
                  </div>
                </div>
              </div>
              {/* Beds */}
              <div className="p-3 space-y-2">
                {room.beds.map((bed: any) => {
                  const statusStyle = bed.rentStatus ? STATUS_STYLES[bed.rentStatus] : null;
                  return (
                    <div
                      key={bed.id}
                      className={`p-3 rounded-lg border ${statusStyle ? `${statusStyle.bg} ${statusStyle.border}` : "border-dashed border-muted-foreground/20"}`}
                    >
                      {bed.isOccupied ? (
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                              {bed.tenant?.name?.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{bed.tenant?.name}</p>
                              <p className="text-xs text-muted-foreground">Bed {bed.number}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">{fmt(bed.monthlyRent)}</p>
                            {statusStyle && (
                              <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${statusStyle.badge}`}>
                                {statusStyle.label}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-1">
                          <p className="text-sm text-muted-foreground">Bed {bed.number} — Vacant</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Room Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-card border rounded-xl w-full max-w-md p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Add Room</h2>
            {error && <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg mb-4">{error}</div>}
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Room Number *</label>
                  <input
                    type="text" required value={form.number}
                    onChange={(e) => setForm({ ...form, number: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="e.g. 101"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Floor</label>
                  <input
                    type="number" value={form.floor}
                    onChange={(e) => setForm({ ...form, floor: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Number of Beds</label>
                <input
                  type="number" min="1" max="8" value={form.bedCount}
                  onChange={(e) => setForm({ ...form, bedCount: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Notes</label>
                <textarea
                  value={form.notes} rows={2}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm rounded-lg border hover:bg-muted">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50">
                  {saving ? "Creating…" : "Add Room"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
