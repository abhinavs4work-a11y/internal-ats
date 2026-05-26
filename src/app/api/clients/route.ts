import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, unauthorizedResponse } from "@/lib/services/auth";
import { logActivity } from "@/lib/services/mappings";
import { ActionType, EntityType } from "@prisma/client";
import { generateClientId } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? "";

  const clients = await prisma.client.findMany({
    where: search
      ? { name: { contains: search, mode: "insensitive" } }
      : undefined,
    include: {
      _count: { select: { roles: true } },
      roles: {
        select: { id: true, roleId: true, title: true, status: true, openings: true },
        orderBy: { createdDate: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(clients);
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { name, pocs = [], notes } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Generate next client ID
    const lastClient = await prisma.client.findFirst({
      orderBy: { createdAt: "desc" },
      select: { clientId: true },
    });

    let nextSeq = 1;
    if (lastClient?.clientId) {
      const match = lastClient.clientId.match(/CLIENT-(\d+)/);
      if (match) nextSeq = parseInt(match[1]) + 1;
    }

    const client = await prisma.client.create({
      data: {
        clientId: generateClientId(nextSeq),
        name,
        pocs: pocs ?? [],
        notes: notes || null,
      },
    });

    await logActivity({
      userId: user.id,
      entityType: EntityType.Client,
      entityId: client.id,
      actionType: ActionType.Created,
      newValue: { name, clientId: client.clientId },
      description: `Client ${client.clientId} - ${name} created`,
    });

    return NextResponse.json(client, { status: 201 });
  } catch (err) {
    console.error("[POST /api/clients]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
