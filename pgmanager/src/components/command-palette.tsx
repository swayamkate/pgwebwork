"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Users, BedDouble, IndianRupee, CreditCard, Upload,
  FileText, BarChart3, Settings, Home, ArrowRight, Clock,
  Building2, X, CornerDownLeft,
} from "lucide-react";

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  icon: any;
  href: string;
  category: string;
}

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut to open
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
    }
  }, [open]);

  // Search as you type
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(() => search(query), 200);
    return () => clearTimeout(timer);
  }, [query]);

  async function search(q: string) {
    setLoading(true);
    try {
      const [tenantsRes, paymentsRes] = await Promise.all([
        fetch(`/api/tenants?search=${encodeURIComponent(q)}`).then((r) => r.json()).catch(() => []),
        fetch(`/api/payments?limit=20`).then((r) => r.json()).catch(() => []),
      ]);

      const items: SearchResult[] = [];

      // Tenant results
      if (Array.isArray(tenantsRes)) {
        tenantsRes.slice(0, 5).forEach((t: any) => {
          items.push({
            id: `tenant-${t.id}`,
            title: t.name,
            subtitle: t.roomNumber ? `Room ${t.roomNumber} · Bed ${t.bedNumber}` : "No room assigned",
            icon: Users,
            href: `/tenants/${t.id}`,
            category: "Tenants",
          });
        });
      }

      // Payment results (search by receipt number)
      if (Array.isArray(paymentsRes)) {
        paymentsRes
          .filter((p: any) =>
            p.tenantName?.toLowerCase().includes(q.toLowerCase()) ||
            p.receiptNumber?.toLowerCase().includes(q.toLowerCase())
          )
          .slice(0, 3)
          .forEach((p: any) => {
            items.push({
              id: `payment-${p.id}`,
              title: `₹${Number(p.amount).toLocaleString("en-IN")} — ${p.tenantName}`,
              subtitle: `${p.rentMonth} · ${p.method?.replace("_", " ")}`,
              icon: CreditCard,
              href: "/payments",
              category: "Payments",
            });
          });
      }

      setResults(items);
      setSelectedIndex(0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function handleSelect(result: SearchResult) {
    router.push(result.href);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      handleSelect(results[selectedIndex]);
    }
  }

  // Quick navigation items
  const quickNav = [
    { title: "Dashboard", icon: Home, href: "/dashboard" },
    { title: "Tenants", icon: Users, href: "/tenants" },
    { title: "Rooms", icon: BedDouble, href: "/rooms" },
    { title: "Payments", icon: IndianRupee, href: "/payments" },
    { title: "Bank Import", icon: Upload, href: "/bank-import" },
    { title: "Reports", icon: BarChart3, href: "/reports" },
    { title: "Settings", icon: Settings, href: "/settings" },
  ];

  const filteredNav = query
    ? quickNav.filter((n) => n.title.toLowerCase().includes(query.toLowerCase()))
    : quickNav;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={() => setOpen(false)}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Palette */}
      <div
        className="relative w-full max-w-lg bg-card border rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <Search className="w-5 h-5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search tenants, payments, or navigate…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground border">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto">
          {loading && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Searching…
            </div>
          )}

          {/* Search results */}
          {!loading && results.length > 0 && (
            <div className="p-2">
              <p className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Results
              </p>
              {results.map((result, i) => {
                const Icon = result.icon;
                return (
                  <button
                    key={result.id}
                    onClick={() => handleSelect(result)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                      i === selectedIndex ? "bg-primary/10 text-primary" : "hover:bg-muted"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{result.title}</p>
                      {result.subtitle && (
                        <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{result.category}</span>
                    <CornerDownLeft className="w-3 h-3 text-muted-foreground shrink-0" />
                  </button>
                );
              })}
            </div>
          )}

          {/* No results */}
          {!loading && query && results.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}

          {/* Quick navigation */}
          {!loading && !query && (
            <div className="p-2">
              <p className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Quick Navigation
              </p>
              {filteredNav.map((nav, i) => {
                const Icon = nav.icon;
                return (
                  <button
                    key={nav.href}
                    onClick={() => { router.push(nav.href); setOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                      i === selectedIndex ? "bg-primary/10 text-primary" : "hover:bg-muted"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="text-sm font-medium">{nav.title}</span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground ml-auto" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t flex items-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-muted border">↑↓</kbd> Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-muted border">↵</kbd> Select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-muted border">esc</kbd> Close
          </span>
        </div>
      </div>
    </div>
  );
}
