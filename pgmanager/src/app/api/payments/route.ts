import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { getCurrentMonth, generateReceiptNumber } from "@/lib/utils";

// GET /api/payments — list payments
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");
    const month = searchParams.get("month");
    const method = searchParams.get("method");
    const limit = parseInt(searchParams.get("limit") || "100");

    // Get PG start date from settings
    const startSetting = await prisma.setting.findUnique({ where: { key: "pg_start_date" } });
    const pgStartDate = startSetting?.value || null;

    const where: any = { isReversed: false };
    if (tenantId) where.tenantId = tenantId;
    if (month) where.rentMonth = month;
    if (method) where.method = method;
    if (pgStartDate) where.date = { gte: new Date(pgStartDate) };

    const payments = await prisma.payment.findMany({
      where,
      include: {
        tenant: { select: { name: true, id: true } },
        rentRecord: true,
      },
      orderBy: { date: "desc" },
      take: limit,
    });

    return NextResponse.json(
      payments.map((p) => ({
        id: p.id,
        tenantId: p.tenantId,
        tenantName: p.tenant.name,
        amount: Number(p.amount),
        date: p.date,
        method: p.method,
        purpose: p.purpose,
        rentMonth: p.rentMonth,
        transactionId: p.transactionId,
        bankReference: p.bankReference,
        receiptNumber: p.receiptNumber,
        notes: p.notes,
        createdAt: p.createdAt,
      }))
    );
  } catch (error) {
    console.error("Payments list error:", error);
    return NextResponse.json({ error: "Failed to load payments" }, { status: 500 });
  }
}

// POST /api/payments — create a payment
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    const { tenantId, amount, date, method, purpose, rentMonth,
            transactionId, bankReference, notes } = body;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant is required" }, { status: 400 });
    }
    if (!amount || parseFloat(amount) <= 0) {
      return NextResponse.json({ error: "Amount must be greater than zero" }, { status: 400 });
    }

    const month = rentMonth || getCurrentMonth();
    const paymentAmount = parseFloat(amount);

    // Find or create rent record for this tenant and month
    let assignment = await prisma.tenantAssignment.findFirst({
      where: { tenantId, isActive: true },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: "Tenant has no active room/bed assignment" },
        { status: 400 }
      );
    }

    let rentRecord = await prisma.rentRecord.findUnique({
      where: { assignmentId_month: { assignmentId: assignment.id, month } },
    });

    if (!rentRecord) {
      rentRecord = await prisma.rentRecord.create({
        data: {
          assignmentId: assignment.id,
          tenantId,
          bedId: assignment.bedId,
          month,
          rentDue: Number(assignment.monthlyRent),
          status: "DUE",
        },
      });
    }

    // Create payment
    const receiptNumber = generateReceiptNumber();
    const payment = await prisma.payment.create({
      data: {
        tenantId,
        amount: paymentAmount,
        date: date ? new Date(date) : new Date(),
        method: method || "BANK_TRANSFER",
        purpose: purpose || "Rent",
        rentMonth: month,
        transactionId: transactionId || null,
        bankReference: bankReference || null,
        receiptNumber,
        notes: notes || null,
        createdBy: user.id,
        rentRecordId: rentRecord.id,
      },
    });

    // Update rent record
    const newPaid = Number(rentRecord.amountPaid) + paymentAmount;
    const rentDue = Number(rentRecord.rentDue);
    let newStatus: string;
    if (newPaid >= rentDue) {
      newStatus = newPaid > rentDue ? "ADVANCE" : "PAID";
    } else {
      newStatus = "PARTIAL";
    }

    await prisma.rentRecord.update({
      where: { id: rentRecord.id },
      data: { amountPaid: newPaid, status: newStatus as any },
    });

    // Create receipt
    await prisma.receipt.create({
      data: {
        receiptNumber,
        paymentId: payment.id,
        tenantId,
        tenantName: "", // Will be set by a trigger or we query
        roomNumber: "",
        bedNumber: "",
        amount: paymentAmount,
        paymentDate: payment.date,
        paymentMethod: payment.method,
        rentMonth: month,
        previousBalance: rentDue - Number(rentRecord.amountPaid),
        amountPaid: paymentAmount,
        remainingBalance: Math.max(0, rentDue - newPaid),
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "CREATE",
        entity: "payment",
        entityId: payment.id,
        newValue: JSON.stringify({ amount: paymentAmount, tenantId, month }),
      },
    });

    // Create notification for overdue
    if (newStatus === "OVERDUE") {
      await prisma.notification.create({
        data: {
          title: "Payment overdue",
          message: `Payment is overdue for rent month ${month}`,
          type: "WARNING",
          entityType: "payment",
          entityId: payment.id,
        },
      });
    }

    return NextResponse.json({ ok: true, payment, receiptNumber });
  } catch (error) {
    console.error("Payment create error:", error);
    return NextResponse.json({ error: "Failed to create payment" }, { status: 500 });
  }
}
