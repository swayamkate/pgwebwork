import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { getCurrentMonth } from "@/lib/utils";

// GET /api/rooms — list all rooms with beds
export async function GET() {
  try {
    await requireAuth();
    const month = getCurrentMonth();

    const rooms = await prisma.room.findMany({
      include: {
        beds: {
          include: {
            assignments: {
              where: { isActive: true },
              include: {
                tenant: true,
                rentRecords: { where: { month } },
              },
            },
          },
          orderBy: { number: "asc" },
        },
      },
      orderBy: { number: "asc" },
    });

    const result = rooms.map((room) => ({
      id: room.id,
      number: room.number,
      floor: room.floor,
      notes: room.notes,
      beds: room.beds.map((bed) => {
        const assignment = bed.assignments[0];
        const rentRecord = assignment?.rentRecords[0];
        return {
          id: bed.id,
          number: bed.number,
          tenant: assignment?.tenant || null,
          monthlyRent: assignment ? Number(assignment.monthlyRent) : 0,
          rentStatus: rentRecord?.status || null,
          amountPaid: rentRecord ? Number(rentRecord.amountPaid) : 0,
          isOccupied: !!assignment,
        };
      }),
      totalBeds: room.beds.length,
      occupiedBeds: room.beds.filter((b) => b.assignments.length > 0).length,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Rooms list error:", error);
    return NextResponse.json({ error: "Failed to load rooms" }, { status: 500 });
  }
}

// POST /api/rooms — create a room with beds
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { number, floor, notes, bedCount } = body;

    if (!number?.trim()) {
      return NextResponse.json({ error: "Room number is required" }, { status: 400 });
    }

    const existing = await prisma.room.findUnique({ where: { number: number.trim() } });
    if (existing) {
      return NextResponse.json({ error: `Room ${number} already exists` }, { status: 409 });
    }

    const count = Math.min(Math.max(parseInt(bedCount) || 1, 1), 8);

    const room = await prisma.room.create({
      data: {
        number: number.trim(),
        floor: parseInt(floor) || 0,
        notes: notes || null,
        beds: {
          create: Array.from({ length: count }, (_, i) => ({
            number: `${i + 1}`,
          })),
        },
      },
      include: { beds: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "CREATE",
        entity: "room",
        entityId: room.id,
        newValue: JSON.stringify({ number: room.number, beds: count }),
      },
    });

    return NextResponse.json({ ok: true, room });
  } catch (error) {
    console.error("Room create error:", error);
    return NextResponse.json({ error: "Failed to create room" }, { status: 500 });
  }
}
