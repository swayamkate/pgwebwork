// CSV Export utility
export function downloadCSV(data: any[], filename: string) {
  if (!data.length) return;

  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers
      .map((h) => {
        const val = row[h];
        const str = val == null ? "" : String(val);
        // Escape quotes and wrap in quotes if contains comma/newline
        if (str.includes(",") || str.includes("\n") || str.includes('"')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      })
      .join(",")
  );

  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportTenantsToCSV(tenants: any[]) {
  const data = tenants.map((t) => ({
    Name: t.name,
    Phone: t.phone || "",
    Email: t.email || "",
    Room: t.roomNumber || "",
    Bed: t.bedNumber || "",
    "Monthly Rent": t.monthlyRent,
    Outstanding: t.outstanding,
    Status: t.status,
  }));
  downloadCSV(data, `tenants-export-${new Date().toISOString().slice(0, 10)}`);
}

export function exportPaymentsToCSV(payments: any[]) {
  const data = payments.map((p) => ({
    Date: new Date(p.date).toISOString().slice(0, 10),
    Tenant: p.tenantName,
    Amount: p.amount,
    Method: p.method,
    "Rent Month": p.rentMonth,
    "Receipt #": p.receiptNumber || "",
    Reference: p.transactionId || p.bankReference || "",
  }));
  downloadCSV(data, `payments-export-${new Date().toISOString().slice(0, 10)}`);
}

export function exportExpensesToCSV(expenses: any[]) {
  const data = expenses.map((e) => ({
    Date: new Date(e.date).toISOString().slice(0, 10),
    Category: e.category,
    Description: e.description,
    Amount: e.amount,
    Vendor: e.vendor || "",
    Reference: e.reference || "",
  }));
  downloadCSV(data, `expenses-export-${new Date().toISOString().slice(0, 10)}`);
}
