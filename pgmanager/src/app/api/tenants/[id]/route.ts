import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { getCurrentMonth } from "@/lib/utils";

// GET /api/tenants/[id]
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAuth();
    const { id } = params;

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        assignments: {
          include: {
            bed: { include: { room: true } },
            rentRecords: { orderBy: { month: "desc" }, take: 12 },
          },
        },
        payments: {
          where: { isReversed: false },
          orderBy: { date: "desc" },
          take: 20,
        },
        aliases: true,
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    return NextResponse.json(tenant);
  } catch (error) {
    return NextResponse.json({ error: "Failed to load tenant" }, { status: 500 });
  }
}

// PUT /api/tenants/[id]
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    const { id } = params;
    const body = await request.json();

    const tenant = await prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const updated = await prisma.tenant.update({
      where: { id },
      data: {
        name: body.name || tenant.name,
        phone: body.phone !== undefined ? body.phone : tenant.phone,
        email: body.email !== undefined ? body.email : tenant.email,
        emergencyContact: body.emergencyContact !== undefined ? body.emergencyContact : tenant.emergencyContact,
        status: body.status || tenant.status,
        notes: body.notes !== undefined ? body.notes : tenant.notes,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "UPDATE",
        entity: "tenant",
        entityId: id,
        previousValue: JSON.stringify({ name: tenant.name }),
        newValue: JSON.stringify({ name: updated.name, status: updated.status }),
      },
    });

    return NextResponse.json({ ok: true, tenant: updated });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update tenant" }, { status: 500 });
  }
}

// DELETE /api/tenants/[id]
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    const { id } = params;

    // Soft delete: mark as CHECKED_OUT, don't remove from DB
    const updated = await prisma.tenant.update({
      where: { id },
      data: { status: "CHECKED_OUT" },
    });

    // Deactivate current assignment
    await prisma.tenantAssignment.updateMany({
      where: { tenantId: id, isActive: true },
      data: { isActive: false, checkoutDate: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "UPDATE",
        entity: "tenant",
        entityId: id,
        newValue: JSON.stringify({ status: "CHECKED_OUT" }),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to remove tenant" }, { status: 500 });
  }
}
