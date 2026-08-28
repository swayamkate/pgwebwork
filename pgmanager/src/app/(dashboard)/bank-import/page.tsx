"use client";

import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, X, Loader2, ArrowRight } from "lucide-react";

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

export default function BankImportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<any>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setError("");
    parseFile(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (!f) return;
    setFile(f);
    setError("");
    parseFile(f);
  }

  async function parseFile(f: File) {
    setLoading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", f);
      const res = await fetch("/api/bank-import", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) { setError(data.error); setStep("upload"); return; }
      setPreview(data);
      setStep("preview");
    } catch {
      setError("Failed to parse file");
      setStep("upload");
    } finally {
      setLoading(false);
    }
  }

  async function confirmImport() {
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("confirmed", "true");
      const res = await fetch("/api/bank-import", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setResult(data);
      setStep("done");
    } catch {
      setError("Failed to import");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStep("upload");
    setFile(null);
    setPreview(null);
    setResult(null);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bank Statement Import</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload a CSV or Excel bank statement to automatically match payments to tenants
        </p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 text-sm">
        {["Upload", "Preview & Match", "Import"].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              (step === "upload" && i === 0) || (step === "preview" && i <= 1) || (step === "done" && i <= 2)
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}>{i + 1}</div>
            <span className={i < ["upload", "preview", "done"].indexOf(step) + 1 ? "text-foreground" : "text-muted-foreground"}>
              {label}
            </span>
            {i < 2 && <ArrowRight className="w-3 h-3 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
          <button onClick={() => setError("")} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="border-2 border-dashed rounded-xl p-12 text-center hover:border-primary/50 transition-colors cursor-pointer"
          onClick={() => fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
          />
          {loading ? (
            <Loader2 className="w-12 h-12 mx-auto mb-3 animate-spin text-primary" />
          ) : (
            <Upload className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
          )}
          <p className="font-medium">
            {loading ? "Parsing statement…" : "Drop your bank statement here, or click to browse"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Supports CSV, TSV, XLSX, and XLS files
          </p>
        </div>
      )}

      {/* Step 2: Preview */}
      {step === "preview" && preview && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total Rows", value: preview.total, color: "" },
              { label: "Auto-Matched", value: preview.matched, color: "text-emerald-500" },
              { label: "Duplicates", value: preview.duplicates, color: "text-amber-500" },
              { label: "Unmatched", value: preview.total - preview.matched, color: "text-red-500" },
            ].map((s) => (
              <div key={s.label} className="bg-card border rounded-lg p-3 text-center">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Preview table */}
          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h2 className="font-semibold text-sm">Transaction Preview</h2>
              <span className="text-xs text-muted-foreground">Showing first {Math.min(preview.transactions?.length || 0, 50)} rows</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b bg-muted/50">
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Description</th>
                    <th className="px-3 py-2 font-medium">Parsed Name</th>
                    <th className="px-3 py-2 font-medium">Amount</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Suggested Tenant</th>
                    <th className="px-3 py-2 font-medium">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.transactions?.map((t: any, i: number) => (
                    <tr key={i} className={`border-b last:border-0 ${t.isDuplicate ? "bg-amber-500/5" : ""}`}>
                      <td className="px-3 py-2 whitespace-nowrap">{t.valueDate}</td>
                      <td className="px-3 py-2 max-w-[200px] truncate">{t.originalDescription}</td>
                      <td className="px-3 py-2 font-medium">{t.parsedName || "—"}</td>
                      <td className={`px-3 py-2 font-medium ${t.type === "CREDIT" ? "text-emerald-500" : "text-red-500"}`}>
                        {t.type === "CREDIT" ? "+" : "-"}{fmt(Math.abs(t.amount))}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-xs ${t.type === "CREDIT" ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"}`}>
                          {t.type}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {t.suggestedTenantName ? (
                          <div>
                            <span className="font-medium">{t.suggestedTenantName}</span>
                            {t.suggestedBed && <span className="text-muted-foreground ml-1">· {t.suggestedBed}</span>}
                          </div>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {t.confidence ? (
                          <span className={`px-1.5 py-0.5 rounded text-xs ${
                            t.confidence >= 80 ? "bg-emerald-500/10 text-emerald-600" :
                            t.confidence >= 50 ? "bg-amber-500/10 text-amber-600" :
                            "bg-red-500/10 text-red-600"
                          }`}>
                            {Math.round(t.confidence)}%
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between">
            <button onClick={reset} className="px-4 py-2 text-sm rounded-lg border hover:bg-muted">
              Cancel
            </button>
            <button
              onClick={confirmImport}
              disabled={loading}
              className="px-6 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Import {preview.total} Transactions
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Done */}
      {step === "done" && result && (
        <div className="text-center py-12">
          <CheckCircle2 className="w-16 h-16 mx-auto text-emerald-500 mb-4" />
          <h2 className="text-xl font-bold">Import Complete!</h2>
          <div className="mt-4 flex justify-center gap-6 text-sm">
            <div><p className="text-2xl font-bold">{result.total}</p><p className="text-muted-foreground">Imported</p></div>
            <div><p className="text-2xl font-bold text-emerald-500">{result.matched}</p><p className="text-muted-foreground">Matched</p></div>
            <div><p className="text-2xl font-bold text-amber-500">{result.duplicates}</p><p className="text-muted-foreground">Duplicates</p></div>
          </div>
          <button onClick={reset} className="mt-8 px-6 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90">
            Import Another Statement
          </button>
        </div>
      )}
    </div>
  );
}
