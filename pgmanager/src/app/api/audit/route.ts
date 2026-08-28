import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const entity = searchParams.get("entity");
    const limit = parseInt(searchParams.get("limit") || "100");

    const where: any = {};
    if (entity) where.entity = entity;

    const logs = await prisma.auditLog.findMany({
      where,
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 500),
    });

    return NextResponse.json(
      logs.map((l) => ({
        id: l.id,
        user: l.user?.name || "System",
        action: l.action,
        entity: l.entity,
        entityId: l.entityId,
        previousValue: l.previousValue,
        newValue: l.newValue,
        createdAt: l.createdAt,
      }))
    );
  } catch (error) {
    return NextResponse.json({ error: "Failed to load audit log" }, { status: 500 });
  }
}
