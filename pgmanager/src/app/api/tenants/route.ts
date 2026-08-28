import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { getCurrentMonth } from "@/lib/utils";

// GET /api/tenants — list all tenants with assignments
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    const where: any = {};
    if (status && status !== "all") where.status = status;

    const tenants = await prisma.tenant.findMany({
      where,
      include: {
        assignments: {
          where: { isActive: true },
          include: {
            bed: { include: { room: true } },
            rentRecords: { where: { month: getCurrentMonth() } },
          },
        },
        payments: {
          where: { isReversed: false },
          orderBy: { date: "desc" },
          take: 1,
        },
        aliases: true,
      },
      orderBy: { name: "asc" },
    });

    // Filter by search
    let filtered = tenants;
    if (search) {
      const q = search.toLowerCase();
      filtered = tenants.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.phone?.toLowerCase().includes(q) ||
          t.email?.toLowerCase().includes(q) ||
          t.assignments.some(
            (a) =>
              a.bed.room.number.toLowerCase().includes(q) ||
              a.bed.number.toLowerCase().includes(q)
          )
      );
    }

    // Calculate outstanding for each tenant
    const result = filtered.map((t) => {
      const assignment = t.assignments[0];
      const rentRecord = assignment?.rentRecords[0];
      const monthlyRent = assignment ? Number(assignment.monthlyRent) : 0;
      const paid = rentRecord ? Number(rentRecord.amountPaid) : 0;
      const outstanding = monthlyRent - paid;

      return {
        id: t.id,
        name: t.name,
        phone: t.phone,
        email: t.email,
        status: t.status,
        roomNumber: assignment?.bed.room.number || null,
        bedNumber: assignment?.bed.number || null,
        monthlyRent,
        currentMonthPaid: paid,
        outstanding,
        lastPayment: t.payments[0] || null,
        createdAt: t.createdAt,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Tenants list error:", error);
    return NextResponse.json({ error: "Failed to load tenants" }, { status: 500 });
  }
}

// POST /api/tenants — create a tenant and optionally assign to a bed
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    const { name, phone, email, emergencyContact, idType, idNumber, notes,
            bedId, monthlyRent, securityDeposit, joiningDate, dueDate, aliases } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Tenant name is required" }, { status: 400 });
    }

    const tenant = await prisma.tenant.create({
      data: {
        name: name.trim(),
        phone: phone || null,
        email: email?.toLowerCase().trim() || null,
        emergencyContact: emergencyContact || null,
        idType: idType || null,
        idNumber: idNumber || null,
        notes: notes || null,
      },
    });

    // Create aliases
    if (aliases?.length) {
      await prisma.tenantAlias.createMany({
        data: aliases.map((a: string) => ({
          tenantId: tenant.id,
          alias: a.trim(),
          source: "manual",
        })),
      });
    }

    // Assign to bed if provided
    if (bedId && monthlyRent) {
      const assignment = await prisma.tenantAssignment.create({
        data: {
          tenantId: tenant.id,
          bedId,
          monthlyRent: parseFloat(monthlyRent),
          securityDeposit: securityDeposit ? parseFloat(securityDeposit) : null,
          joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
          dueDate: dueDate || 5,
        },
      });

      // Create current month rent record
      const month = getCurrentMonth();
      await prisma.rentRecord.create({
        data: {
          assignmentId: assignment.id,
          tenantId: tenant.id,
          bedId,
          month,
          rentDue: parseFloat(monthlyRent),
          status: "DUE",
        },
      });
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "CREATE",
        entity: "tenant",
        entityId: tenant.id,
        newValue: JSON.stringify({ name: tenant.name }),
      },
    });

    return NextResponse.json({ ok: true, tenant });
  } catch (error) {
    console.error("Tenant create error:", error);
    return NextResponse.json({ error: "Failed to create tenant" }, { status: 500 });
  }
}
