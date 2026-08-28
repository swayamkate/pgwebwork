"use client";

import { useState, useEffect } from "react";
import { Save, Building2 } from "lucide-react";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(setSettings)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  function update(key: string, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading settings…</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure your PG Manager application</p>
      </div>

      {/* Property Settings */}
      <div className="bg-card border rounded-xl p-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Building2 className="w-4 h-4" /> Property Details
        </h2>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Hostel / PG Name</label>
            <input type="text" value={settings.hostel_name || ""}
              onChange={(e) => update("hostel_name", e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="e.g. Sunshine PG" />
          </div>
          <div>
            <label className="text-sm font-medium">Address</label>
            <textarea value={settings.address || ""} rows={2}
              onChange={(e) => update("address", e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Contact Phone</label>
              <input type="tel" value={settings.contact_phone || ""}
                onChange={(e) => update("contact_phone", e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-lg bg-background text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium">Contact Email</label>
              <input type="email" value={settings.contact_email || ""}
                onChange={(e) => update("contact_email", e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-lg bg-background text-sm" />
            </div>
          </div>
        </div>
      </div>

      {/* Rent Settings */}
      <div className="bg-card border rounded-xl p-6">
        <h2 className="font-semibold mb-4">Rent Settings</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Default Due Date (day of month)</label>
              <input type="number" min="1" max="31" value={settings.rent_due_date || "5"}
                onChange={(e) => update("rent_due_date", e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-lg bg-background text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium">Currency</label>
              <input type="text" value={settings.currency || "INR"} disabled
                className="w-full mt-1 px-3 py-2 border rounded-lg bg-background text-sm opacity-50" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Receipt Number Prefix</label>
            <input type="text" value={settings.receipt_prefix || "RCP"}
              onChange={(e) => update("receipt_prefix", e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg bg-background text-sm"
              placeholder="RCP" />
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
          <Save className="w-4 h-4" />
          {saving ? "Saving…" : saved ? "Saved!" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
