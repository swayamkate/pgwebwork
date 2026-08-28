import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// GET /api/rooms/[id]
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAuth();
    const room = await prisma.room.findUnique({
      where: { id: params.id },
      include: {
        beds: {
          include: {
            assignments: {
              where: { isActive: true },
              include: { tenant: true },
            },
          },
        },
      },
    });
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
    return NextResponse.json(room);
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// PUT /api/rooms/[id]
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    const room = await prisma.room.update({
      where: { id: params.id },
      data: {
        number: body.number || undefined,
        floor: body.floor !== undefined ? parseInt(body.floor) : undefined,
        notes: body.notes !== undefined ? body.notes : undefined,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "UPDATE",
        entity: "room",
        entityId: params.id,
        newValue: JSON.stringify({ number: room.number }),
      },
    });

    return NextResponse.json({ ok: true, room });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update room" }, { status: 500 });
  }
}

// DELETE /api/rooms/[id]
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();

    // Check for active tenants
    const activeBeds = await prisma.tenantAssignment.count({
      where: { bed: { roomId: params.id }, isActive: true },
    });
    if (activeBeds > 0) {
      return NextResponse.json(
        { error: "Cannot delete room with active tenants. Check them out first." },
        { status: 400 }
      );
    }

    await prisma.room.delete({ where: { id: params.id } });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "DELETE",
        entity: "room",
        entityId: params.id,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete room" }, { status: 500 });
  }
}
