import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { getCurrentMonth } from "@/lib/utils";

// POST /api/bank-import/match — Match a bank transaction to a tenant and create payment
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { transactionId, tenantId, rentMonth, amount } = body;

    if (!transactionId || !tenantId) {
      return NextResponse.json(
        { error: "Transaction ID and Tenant ID are required" },
        { status: 400 }
      );
    }

    const txn = await prisma.bankTransaction.findUnique({ where: { id: transactionId } });
    if (!txn) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const month = rentMonth || getCurrentMonth();
    const paymentAmount = amount ? parseFloat(amount) : Number(txn.amount);

    // Find tenant's active assignment
    const assignment = await prisma.tenantAssignment.findFirst({
      where: { tenantId, isActive: true },
      include: { bed: { include: { room: true } } },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: "Tenant has no active room assignment" },
        { status: 400 }
      );
    }

    // Find or create rent record
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

    // Create payment linked to the bank transaction
    const receiptNumber = `RCP-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(Math.floor(Math.random() * 9999)).padStart(4, "0")}`;

    const payment = await prisma.payment.create({
      data: {
        tenantId,
        amount: paymentAmount,
        date: txn.valueDate,
        method: "BANK_TRANSFER",
        purpose: "Rent",
        rentMonth: month,
        transactionId: txn.reference,
        bankReference: txn.reference,
        receiptNumber,
        createdBy: user.id,
        bankTransactionId: txn.id,
      },
    });

    // Update rent record
    const newPaid = Number(rentRecord.amountPaid) + paymentAmount;
    const rentDue = Number(rentRecord.rentDue);
    let newStatus = newPaid >= rentDue ? (newPaid > rentDue ? "ADVANCE" : "PAID") : "PARTIAL";

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
        tenantName: tenant.name,
        roomNumber: assignment.bed.room.number,
        bedNumber: assignment.bed.number,
        amount: paymentAmount,
        paymentDate: txn.valueDate,
        paymentMethod: "BANK_TRANSFER",
        rentMonth: month,
        previousBalance: rentDue - Number(rentRecord.amountPaid),
        amountPaid: paymentAmount,
        remainingBalance: Math.max(0, rentDue - newPaid),
      },
    });

    // Update transaction status
    await prisma.bankTransaction.update({
      where: { id: transactionId },
      data: { status: "MATCHED", confidence: 100 },
    });

    // Create tenant alias from parsed name if not exists
    if (txn.parsedName) {
      await prisma.tenantAlias.upsert({
        where: { tenantId_alias: { tenantId, alias: txn.parsedName } },
        update: {},
        create: { tenantId, alias: txn.parsedName, source: "bank_import" },
      }).catch(() => {});
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "MATCH",
        entity: "bank_transaction",
        entityId: transactionId,
        newValue: JSON.stringify({ tenantId, tenantName: tenant.name, amount: paymentAmount }),
      },
    });

    // Notification
    if (newPaid < rentDue) {
      await prisma.notification.create({
        data: {
          title: "Partial payment matched",
          message: `${tenant.name}: ${paymentAmount} received, ${rentDue - newPaid} remaining for ${month}`,
          type: "INFO",
          entityType: "payment",
          entityId: payment.id,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      payment,
      receiptNumber,
      rentStatus: newStatus,
      remaining: Math.max(0, rentDue - newPaid),
    });
  } catch (error) {
    console.error("Match error:", error);
    return NextResponse.json({ error: "Failed to match transaction" }, { status: 500 });
  }
}
