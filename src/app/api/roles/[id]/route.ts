import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, unauthorizedResponse } from "@/lib/services/auth";
import { logActivity } from "@/lib/services/mappings";
import { ActionType, EntityType, RolePriority, RoleStatus, Prisma } from "@prisma/client";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  const { id } = await params;

  const role = await prisma.role.findUnique({
    where: { id },
    include: {
      client: true,
      recruiters: { include: { recruiter: { select: { id: true, name: true, email: true } } } },
      _count: { select: { mappings: true } },
    },
  });

  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(role);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  const { id } = await params;

  try {
    const body = await request.json();
    const { title, budget, openings, locations, jd, priority, status, recruiterIds, poc } = body;

    const existing = await prisma.role.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // For Prisma Json? fields: pass the object as-is, or use DbNull for SQL NULL
    const pocValue: Prisma.InputJsonValue | typeof Prisma.DbNull | undefined =
      poc === undefined
        ? undefined
        : poc === null
        ? Prisma.DbNull
        : poc;

    const role = await prisma.role.update({
      where: { id },
      data: {
        ...(title      !== undefined && title      && { title }),
        ...(budget     !== undefined && { budget: budget ? parseFloat(budget) : null }),
        ...(openings   !== undefined && { openings }),
        ...(locations  !== undefined && locations && { locations }),
        ...(jd         !== undefined && { jd }),
        ...(priority   !== undefined && priority   && { priority: priority as RolePriority }),
        ...(status     !== undefined && status     && { status:   status   as RoleStatus   }),
        ...(pocValue   !== undefined && { poc: pocValue }),
        ...(recruiterIds !== undefined && recruiterIds && {
          recruiters: {
            deleteMany: {},
            create: recruiterIds.map((rid: string) => ({ recruiterId: rid })),
          },
        }),
      },
      include: {
        client:     { select: { id: true, name: true } },
        recruiters: { include: { recruiter: { select: { id: true, name: true } } } },
      },
    });

    await logActivity({
      userId: user.id,
      entityType: EntityType.Role,
      entityId: id,
      actionType: ActionType.Updated,
      oldValue: { status: existing.status },
      newValue: { status: role.status },
      description: `Role ${role.roleId} updated`,
    });

    return NextResponse.json(role);
  } catch (err) {
    console.error("[PUT /api/roles/:id]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update role" },
      { status: 500 }
    );
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  const { id } = await params;

  try {
    const role = await prisma.role.findUnique({ where: { id } });
    if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.role.delete({ where: { id } });

    await logActivity({
      userId: user.id,
      entityType: EntityType.Role,
      entityId: id,
      actionType: ActionType.Deleted,
      oldValue: { roleId: role.roleId, title: role.title },
      description: `Role ${role.roleId} deleted`,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/roles/:id]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete role" },
      { status: 500 }
    );
  }
}
