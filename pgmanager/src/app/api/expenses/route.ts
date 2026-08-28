import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// GET /api/expenses
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const month = searchParams.get("month");

    // Get PG start date from settings
    const startSetting = await prisma.setting.findUnique({ where: { key: "pg_start_date" } });
    const pgStartDate = startSetting?.value || null;

    const where: any = {};
    if (pgStartDate) where.date = { gte: new Date(pgStartDate) };
    if (category) where.category = category;
    if (month) {
      where.date = {
        gte: new Date(`${month}-01`),
        lt: new Date(`${month}-31`),
      };
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: { user: { select: { name: true } } },
      orderBy: { date: "desc" },
      take: 200,
    });

    return NextResponse.json(
      expenses.map((e) => ({
        id: e.id,
        date: e.date,
        category: e.category,
        description: e.description,
        amount: Number(e.amount),
        method: e.method,
        vendor: e.vendor,
        reference: e.reference,
        notes: e.notes,
        createdBy: e.user?.name || null,
      }))
    );
  } catch (error) {
    return NextResponse.json({ error: "Failed to load expenses" }, { status: 500 });
  }
}

// POST /api/expenses
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { date, category, description, amount, method, vendor, reference, notes } = body;

    if (!description?.trim()) {
      return NextResponse.json({ error: "Description is required" }, { status: 400 });
    }
    if (!amount || parseFloat(amount) <= 0) {
      return NextResponse.json({ error: "Amount must be greater than zero" }, { status: 400 });
    }

    const expense = await prisma.expense.create({
      data: {
        date: date ? new Date(date) : new Date(),
        category: category || "OTHER",
        description: description.trim(),
        amount: parseFloat(amount),
        method: method || "BANK_TRANSFER",
        vendor: vendor || null,
        reference: reference || null,
        notes: notes || null,
        createdBy: user.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "CREATE",
        entity: "expense",
        entityId: expense.id,
        newValue: JSON.stringify({ description, amount, category }),
      },
    });

    return NextResponse.json({ ok: true, expense });
  } catch (error) {
    console.error("Expense create error:", error);
    return NextResponse.json({ error: "Failed to create expense" }, { status: 500 });
  }
}

// DELETE /api/expenses?id=xxx
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Expense ID required" }, { status: 400 });
    }

    const expense = await prisma.expense.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "DELETE",
        entity: "expense",
        entityId: id,
        previousValue: JSON.stringify({ description: expense.description, amount: Number(expense.amount) }),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete expense" }, { status: 500 });
  }
}
