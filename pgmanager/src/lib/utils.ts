import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string | bigint): string {
  const num = typeof amount === "string" ? parseFloat(amount) : Number(amount);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getCurrentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function getMonthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function generateReceiptNumber(): string {
  const d = new Date();
  const prefix = "RCP";
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
  const rand = Math.floor(Math.random() * 9999)
    .toString()
    .padStart(4, "0");
  return `${prefix}-${date}-${rand}`;
}

export function daysBetween(a: Date | string, b: Date | string): number {
  const da = typeof a === "string" ? new Date(a) : a;
  const db = typeof b === "string" ? new Date(b) : b;
  return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}

export function parseUPIName(description: string): string | null {
  // Common UPI patterns: "UPI/NAME/UPIREF" or "UPI-PAYEE NAME-..."
  const upiMatch = description.match(/UPI[/\-_](?:[\w]+[/\-_])?([A-Z][A-Z\s]{2,30})(?:[/\-_]|$)/i);
  if (upiMatch) return upiMatch[1].trim();

  // NEFT/RTGS patterns
  const neftMatch = description.match(/(?:NEFT|RTGS|IMPS)[\/\-_]+(?:[\w]+[\/\-_])*([A-Z][A-Z\s]{2,30})(?:[\/\-_]|$)/i);
  if (neftMatch) return neftMatch[1].trim();

  return null;
}
