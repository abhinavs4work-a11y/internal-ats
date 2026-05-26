import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, unauthorizedResponse } from "@/lib/services/auth";
import { updateMappingStatus, logActivity } from "@/lib/services/mappings";
import { ActionType, EntityType, MappingStatus, RejectionReason } from "@prisma/client";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  const { id } = await params;

  const mapping = await prisma.candidateRoleMapping.findUnique({
    where: { id },
    include: {
      candidate: true,
      role: { include: { client: true } },
      recruiter: { select: { id: true, name: true } },
      marginCalculation: true,
    },
  });

  if (!mapping) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(mapping);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  const { id } = await params;

  const body = await request.json();
  const { status, rejectionReason, rejectionCustomReason, notes, clientPoc, recruiterId } = body;

  const existing = await prisma.candidateRoleMapping.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // If status is being updated, use the dedicated status service
  if (status && status !== existing.status) {
    const updated = await updateMappingStatus({
      mappingId: id,
      newStatus: status as MappingStatus,
      userId: user.id,
      rejectionReason: rejectionReason as RejectionReason | undefined,
      rejectionCustomReason,
    });
    return NextResponse.json(updated);
  }

  // Otherwise update other fields
  const updated = await prisma.candidateRoleMapping.update({
    where: { id },
    data: {
      ...(notes !== undefined && { notes }),
      ...(clientPoc !== undefined && { clientPoc }),
      ...(recruiterId && { recruiterId }),
    },
  });

  await logActivity({
    userId: user.id,
    entityType: EntityType.Mapping,
    entityId: id,
    actionType: ActionType.Updated,
    description: `Mapping updated`,
  });

  return NextResponse.json(updated);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  const { id } = await params;

  const mapping = await prisma.candidateRoleMapping.findUnique({
    where: { id },
    include: { candidate: { select: { candidateId: true } }, role: { select: { roleId: true } } },
  });
  if (!mapping) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.candidateRoleMapping.delete({ where: { id } });

  await logActivity({
    userId: user.id,
    entityType: EntityType.Mapping,
    entityId: id,
    actionType: ActionType.Deleted,
    description: `Mapping removed: ${mapping.candidate.candidateId} from ${mapping.role.roleId}`,
  });

  return NextResponse.json({ success: true });
}
