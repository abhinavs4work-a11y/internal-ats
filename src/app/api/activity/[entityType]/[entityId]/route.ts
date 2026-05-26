import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, unauthorizedResponse } from "@/lib/services/auth";
import { EntityType } from "@prisma/client";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ entityType: string; entityId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  const { entityType, entityId } = await params;

  const logs = await prisma.activityLog.findMany({
    where: {
      entityType: entityType as EntityType,
      entityId,
    },
    include: {
      user: { select: { id: true, name: true } },
    },
    orderBy: { timestamp: "desc" },
    take: 100,
  });

  return NextResponse.json(logs);
}
