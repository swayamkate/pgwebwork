import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { getCurrentMonth } from "@/lib/utils";

export async function GET() {
  try {
    await requireAuth();
    const month = getCurrentMonth();

    // Get PG start date from settings
    const startSetting = await prisma.setting.findUnique({ where: { key: "pg_start_date" } });
    const pgStartDate = startSetting?.value || null;
    const startFilter = pgStartDate ? { gte: new Date(pgStartDate) } : undefined;

    // Run all queries in parallel
    const [
      totalRooms,
      totalBeds,
      assignments,
      rentRecords,
      payments,
      expenses,
      unmatchedTxns,
    ] = await Promise.all([
      prisma.room.count(),
      prisma.bed.count(),
      prisma.tenantAssignment.findMany({
        where: { isActive: true },
        include: { tenant: true, bed: { include: { room: true } } },
      }),
      prisma.rentRecord.findMany({ where: { month } }),
      prisma.payment.findMany({
        where: { isReversed: false, ...(startFilter ? { date: startFilter } : {}) },
        orderBy: { date: "desc" },
      }),
      prisma.expense.findMany({
        where: startFilter ? { date: startFilter } : {},
        orderBy: { date: "desc" },
      }),
      prisma.bankTransaction.count({
        where: { status: "UNMATCHED" },
      }),
    ]);

    const occupiedBeds = assignments.length;
    const vacantBeds = totalBeds - occupiedBeds;
    const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    // Financial calculations
    const currentMonthPayments = payments.filter(
      (p) => p.rentMonth === month && !p.isReversed
    );
    const currentMonthCollection = currentMonthPayments.reduce(
      (sum, p) => sum + Number(p.amount), 0
    );
    const totalCollection = payments
      .filter((p) => !p.isReversed)
      .reduce((sum, p) => sum + Number(p.amount), 0);

    // Today's collection
    const today = new Date().toISOString().slice(0, 10);
    const todayPayments = payments.filter(
      (p) => p.date.toISOString().slice(0, 10) === today && !p.isReversed
    );
    const todayCollection = todayPayments.reduce(
      (sum, p) => sum + Number(p.amount), 0
    );

    // Rent status
    const paidRecords = rentRecords.filter((r) => r.status === "PAID");
    const partialRecords = rentRecords.filter((r) => r.status === "PARTIAL");
    const dueRecords = rentRecords.filter((r) => r.status === "DUE");
    const overdueRecords = rentRecords.filter((r) => r.status === "OVERDUE");

    const pendingRent = dueRecords.reduce((sum, r) => {
      const due = Number(r.rentDue);
      const paid = Number(r.amountPaid);
      return sum + (due - paid);
    }, 0);

    const overdueRent = overdueRecords.reduce((sum, r) => {
      const due = Number(r.rentDue);
      const paid = Number(r.amountPaid);
      return sum + (due - paid);
    }, 0);

    // Expenses
    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const currentMonthExpenses = expenses
      .filter((e) => e.date.toISOString().slice(0, 7) === month)
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const netIncome = totalCollection - totalExpenses;
    const currentMonthNet = currentMonthCollection - currentMonthExpenses;

    // Monthly revenue data (last 12 months)
    const monthlyRevenue: { month: string; revenue: number; expenses: number; net: number }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
      const rev = payments
        .filter((p) => p.rentMonth === mk && !p.isReversed)
        .reduce((s, p) => s + Number(p.amount), 0);
      const exp = expenses
        .filter((e) => e.date.toISOString().slice(0, 7) === mk)
        .reduce((s, e) => s + Number(e.amount), 0);
      monthlyRevenue.push({ month: label, revenue: rev, expenses: exp, net: rev - exp });
    }

    // Payment method breakdown
    const methodBreakdown: Record<string, number> = {};
    payments.filter((p) => !p.isReversed).forEach((p) => {
      methodBreakdown[p.method] = (methodBreakdown[p.method] || 0) + Number(p.amount);
    });

    // Tenant-level rent breakdown (who owes what)
    const tenantBreakdown = assignments.map((a) => {
      const rr = rentRecords.find((r) => r.assignmentId === a.id);
      const paid = rr ? Number(rr.amountPaid) : 0;
      const due = rr ? Number(rr.rentDue) : Number(a.monthlyRent);
      const remaining = Math.max(0, due - paid);
      const status = rr?.status || (paid > 0 ? "PARTIAL" : "DUE");
      return {
        tenantId: a.tenantId,
        tenantName: a.tenant.name,
        roomNumber: a.bed.room.number,
        bedNumber: a.bed.number,
        monthlyRent: due,
        paid,
        remaining,
        status,
        joiningDate: a.joiningDate,
      };
    }).sort((a, b) => b.remaining - a.remaining);

    // Recent payments with tenant names
    const recentWithNames = payments.slice(0, 15).map((p) => {
      const assignment = assignments.find((a) => a.tenantId === p.tenantId);
      return {
        id: p.id,
        tenantName: assignment?.tenant.name || "Unknown",
        roomNumber: assignment?.bed.room.number || "—",
        amount: Number(p.amount),
        date: p.date,
        method: p.method,
        rentMonth: p.rentMonth,
      };
    });

    // Today's activity
    const todayPayments = recentWithNames.filter(
      (p) => p.date.toISOString().slice(0, 10) === today
    );

    return NextResponse.json({
      occupancy: {
        totalRooms,
        totalBeds,
        occupiedBeds,
        vacantBeds,
        occupancyRate,
      },
      financial: {
        totalCollection,
        currentMonthCollection,
        todayCollection,
        totalExpenses,
        currentMonthExpenses,
        netIncome,
        currentMonthNet,
        pendingRent,
        overdueRent,
      },
      rentStatus: {
        paid: paidRecords.length,
        partial: partialRecords.length,
        due: dueRecords.length,
        overdue: overdueRecords.length,
        total: rentRecords.length,
      },
      charts: {
        monthlyRevenue,
        methodBreakdown,
      },
      tenantBreakdown,
      todayPayments,
      recentPayments: recentWithNames,
      unmatchedTransactions: unmatchedTxns,
      pgStartDate: pgStartDate || null,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json(
      { error: "Failed to load dashboard" },
      { status: 500 }
    );
  }
}
