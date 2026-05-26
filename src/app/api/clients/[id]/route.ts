import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, unauthorizedResponse } from "@/lib/services/auth";
import { logActivity } from "@/lib/services/mappings";
import { ActionType, EntityType } from "@prisma/client";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      roles: {
        include: { _count: { select: { mappings: true } } },
        orderBy: { createdDate: "desc" },
      },
    },
  });

  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(client);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  const { id } = await params;

  try {
    const body = await request.json();
    const { name, pocs, notes } = body;

    const existing = await prisma.client.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updated = await prisma.client.update({
      where: { id },
      data: { name, pocs: pocs ?? [], notes: notes || null },
    });

    await logActivity({
      userId: user.id,
      entityType: EntityType.Client,
      entityId: id,
      actionType: ActionType.Updated,
      oldValue: { name: existing.name },
      newValue: { name: updated.name },
      description: `Client ${updated.clientId} updated`,
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PUT /api/clients/:id]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH — append a single POC to the client's poc list without replacing the whole array
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  const { id } = await params;

  const body = await request.json();
  const { action, poc } = body as { action: string; poc?: { name: string; email: string } };

  if (action === "addPoc") {
    if (!poc?.name?.trim()) {
      return NextResponse.json({ error: "POC name is required" }, { status: 400 });
    }

    const client = await prisma.client.findUnique({ where: { id } });
    if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const existing = (client.pocs as { name: string; email: string }[]) ?? [];
    const newPoc   = { name: poc.name.trim(), email: poc.email?.trim() ?? "" };
    const updated  = await prisma.client.update({
      where: { id },
      data: { pocs: [...existing, newPoc] },
    });

    await logActivity({
      userId: user.id,
      entityType: EntityType.Client,
      entityId: id,
      actionType: ActionType.Updated,
      newValue: { addedPoc: newPoc },
      description: `POC ${newPoc.name} added to client ${updated.clientId}`,
    });

    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  const { id } = await params;

  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.client.delete({ where: { id } });

  await logActivity({
    userId: user.id,
    entityType: EntityType.Client,
    entityId: id,
    actionType: ActionType.Deleted,
    oldValue: { name: client.name, clientId: client.clientId },
    description: `Client ${client.clientId} deleted`,
  });

  return NextResponse.json({ success: true });
}
