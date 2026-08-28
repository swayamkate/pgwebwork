"use client";

import { useState, useEffect } from "react";
import { ClipboardList, Filter } from "lucide-react";

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState("");

  useEffect(() => { loadLogs(); }, [entityFilter]);

  async function loadLogs() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (entityFilter) params.set("entity", entityFilter);
      const res = await fetch(`/api/audit?${params}`);
      setLogs(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  const ACTION_BADGES: Record<string, string> = {
    CREATE: "bg-emerald-500/10 text-emerald-600",
    UPDATE: "bg-blue-500/10 text-blue-600",
    DELETE: "bg-red-500/10 text-red-600",
    IMPORT: "bg-purple-500/10 text-purple-600",
    LOGIN: "bg-muted text-muted-foreground",
    MATCH: "bg-amber-500/10 text-amber-600",
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="text-sm text-muted-foreground">Track all financial and data changes</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {["", "payment", "tenant", "room", "expense", "bank_transaction", "user", "setting"].map((e) => (
          <button key={e} onClick={() => setEntityFilter(e)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              entityFilter === e ? "bg-primary/10 border-primary/30 text-primary" : "bg-card hover:bg-muted"
            }`}>
            {e || "All"}
          </button>
        ))}
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading…</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No audit records yet</div>
        ) : (
          <div className="divide-y">
            {logs.map((log) => (
              <div key={log.id} className="px-4 py-3 hover:bg-muted/30">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                    <ClipboardList className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${ACTION_BADGES[log.action] || ""}`}>
                        {log.action}
                      </span>
                      <span className="text-xs text-muted-foreground">{log.entity}</span>
                      <span className="text-xs text-muted-foreground">by {log.user}</span>
                    </div>
                    {log.newValue && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">{log.newValue}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(log.createdAt).toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
