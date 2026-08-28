import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { getCurrentMonth } from "@/lib/utils";

export async function GET() {
  try {
    await requireAuth();
    const month = getCurrentMonth();

    const startSetting = await prisma.setting.findUnique({ where: { key: "pg_start_date" } });
    const pgStartDate = startSetting?.value || null;
    const startFilter = pgStartDate ? { gte: new Date(pgStartDate) } : undefined;

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
      }),
      prisma.bankTransaction.count({ where: { status: "UNMATCHED" } }),
    ]);

    const occupiedBeds = assignments.length;
    const vacantBeds = totalBeds - occupiedBeds;
    const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    // Financial
    const currentMonthPayments = payments.filter((p) => p.rentMonth === month && !p.isReversed);
    const currentMonthCollection = currentMonthPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const totalCollection = payments.filter((p) => !p.isReversed).reduce((sum, p) => sum + Number(p.amount), 0);

    const today = new Date().toISOString().slice(0, 10);
    const todayPayments = payments.filter((p) => p.date.toISOString().slice(0, 10) === today && !p.isReversed);
    const todayCollection = todayPayments.reduce((sum, p) => sum + Number(p.amount), 0);

    // Rent status
    const paidRecords = rentRecords.filter((r) => r.status === "PAID");
    const partialRecords = rentRecords.filter((r) => r.status === "PARTIAL");
    const dueRecords = rentRecords.filter((r) => r.status === "DUE");
    const overdueRecords = rentRecords.filter((r) => r.status === "OVERDUE");

    const pendingRent = [...dueRecords, ...partialRecords].reduce((sum, r) => {
      return sum + Math.max(0, Number(r.rentDue) - Number(r.amountPaid));
    }, 0);

    const overdueRent = overdueRecords.reduce((sum, r) => {
      return sum + Math.max(0, Number(r.rentDue) - Number(r.amountPaid));
    }, 0);

    // Expenses
    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const currentMonthExpenses = expenses
      .filter((e) => e.date.toISOString().slice(0, 7) === month)
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const netIncome = totalCollection - totalExpenses;

    // Tenant breakdown
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
      };
    }).sort((a, b) => b.remaining - a.remaining);

    return NextResponse.json({
      occupancy: { totalRooms, totalBeds, occupiedBeds, vacantBeds, occupancyRate },
      financial: {
        totalCollection, currentMonthCollection, todayCollection,
        totalExpenses, currentMonthExpenses, netIncome,
        pendingRent, overdueRent,
      },
      rentStatus: {
        paid: paidRecords.length, partial: partialRecords.length,
        due: dueRecords.length, overdue: overdueRecords.length,
        total: rentRecords.length,
      },
      tenantBreakdown,
      todayPayments: todayPayments.map((p) => ({
        id: p.id, amount: Number(p.amount), date: p.date,
      })),
      unmatchedTransactions: unmatchedTxns,
      pgStartDate: pgStartDate || null,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}
