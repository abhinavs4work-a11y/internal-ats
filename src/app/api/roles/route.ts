import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, unauthorizedResponse } from "@/lib/services/auth";
import { logActivity } from "@/lib/services/mappings";
import { ActionType, EntityType, RolePriority, RoleStatus } from "@prisma/client";
import { generateRoleId } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status");
  const clientId = searchParams.get("clientId");
  const priority = searchParams.get("priority");
  const recruiterId = searchParams.get("recruiterId");

  const roles = await prisma.role.findMany({
    where: {
      AND: [
        search
          ? {
              OR: [
                { title: { contains: search, mode: "insensitive" } },
                { roleId: { contains: search, mode: "insensitive" } },
              ],
            }
          : {},
        status ? { status: status as RoleStatus } : {},
        clientId ? { clientId } : {},
        priority ? { priority: priority as RolePriority } : {},
        recruiterId ? { recruiters: { some: { recruiterId } } } : {},
      ],
    },
    include: {
      client: { select: { id: true, name: true, clientId: true } },
      recruiters: { include: { recruiter: { select: { id: true, name: true } } } },
      _count: { select: { mappings: true } },
    },
    orderBy: { createdDate: "desc" },
  });

  return NextResponse.json(roles);
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();

  const body = await request.json();
  const { roleIds, action, date } = body as {
    roleIds: string[];
    action: "updateCreatedDate";
    date?: string;
  };

  if (!roleIds?.length || !action) {
    return NextResponse.json({ error: "roleIds and action are required" }, { status: 400 });
  }

  if (action === "updateCreatedDate") {
    if (!date) return NextResponse.json({ error: "date is required" }, { status: 400 });
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }

    const results = await Promise.allSettled(
      roleIds.map((id) =>
        prisma.role.update({ where: { id }, data: { createdDate: parsedDate } })
      )
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed    = results.filter((r) => r.status === "rejected").length;

    // Log for first updated role as representative entry
    if (succeeded > 0) {
      await logActivity({
        userId: user.id,
        entityType: EntityType.Role,
        entityId: roleIds[0],
        actionType: ActionType.Updated,
        newValue: { createdDate: date, affectedCount: succeeded },
        description: `Bulk updated createdDate to ${date} for ${succeeded} role(s)`,
      });
    }

    return NextResponse.json({ succeeded, failed });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();

  const body = await request.json();
  const {
    title,
    clientId,
    budget,
    openings = 1,
    locations = [],
    jd,
    priority = "Medium",
    status = "Active",
    recruiterIds = [],
    poc = null,
  } = body;

  if (!title || !clientId) {
    return NextResponse.json({ error: "Title and client are required" }, { status: 400 });
  }

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  // Generate sequential role ID scoped to client (e.g. INFS-01, INFS-02)
  const rolesForClient = await prisma.role.findMany({
    where: { clientId },
    select: { roleId: true },
    orderBy: { createdDate: "asc" },
  });
  const nextSeq = rolesForClient.length + 1;
  const roleId = generateRoleId(client.name, nextSeq);

  const role = await prisma.role.create({
    data: {
      roleId,
      title,
      clientId,
      budget: budget ? parseFloat(budget) : null,
      openings,
      locations,
      jd,
      priority: priority as RolePriority,
      status:   status   as RoleStatus,
      poc:      poc ?? null,
      recruiters: {
        create: recruiterIds.map((rid: string) => ({ recruiterId: rid })),
      },
    },
    include: {
      client: { select: { id: true, name: true } },
      recruiters: { include: { recruiter: { select: { id: true, name: true } } } },
    },
  });

  await logActivity({
    userId: user.id,
    entityType: EntityType.Role,
    entityId: role.id,
    actionType: ActionType.Created,
    newValue: { roleId, title, clientId },
    description: `Role ${roleId} - ${title} created`,
  });

  return NextResponse.json(role, { status: 201 });
}
