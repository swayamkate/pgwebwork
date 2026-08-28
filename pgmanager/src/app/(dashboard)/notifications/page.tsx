"use client";

import { useState, useEffect } from "react";
import { Bell, BellOff, CheckCheck } from "lucide-react";

const TYPE_ICONS: Record<string, string> = {
  INFO: "bg-blue-500/10 text-blue-500",
  WARNING: "bg-amber-500/10 text-amber-500",
  URGENT: "bg-red-500/10 text-red-500",
  SUCCESS: "bg-emerald-500/10 text-emerald-500",
};

export default function NotificationsPage() {
  const [data, setData] = useState<any>({ notifications: [], unread: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadNotifications(); }, []);

  async function loadNotifications() {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      setData(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
    loadNotifications();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground">{data.unread} unread</p>
        </div>
        {data.unread > 0 && (
          <button onClick={markAllRead}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg border hover:bg-muted">
            <CheckCheck className="w-4 h-4" /> Mark all read
          </button>
        )}
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading…</div>
        ) : data.notifications.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <BellOff className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No notifications</p>
          </div>
        ) : (
          <div className="divide-y">
            {data.notifications.map((n: any) => (
              <div key={n.id} className={`px-4 py-3 ${!n.isRead ? "bg-primary/5" : ""}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${TYPE_ICONS[n.type] || TYPE_ICONS.INFO}`}>
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(n.createdAt).toLocaleString("en-IN")}
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
