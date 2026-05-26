import { prisma } from "@/lib/prisma";
import { MappingStatus, RejectionReason, ActionType, EntityType } from "@prisma/client";

/**
 * The CORE status update function.
 * Every status change flows through here — kanban drag, dropdown, bulk update.
 * Atomically updates the mapping AND creates the activity log entry.
 */
export async function updateMappingStatus({
  mappingId,
  newStatus,
  userId,
  rejectionReason,
  rejectionCustomReason,
}: {
  mappingId: string;
  newStatus: MappingStatus;
  userId: string;
  rejectionReason?: RejectionReason;
  rejectionCustomReason?: string;
}) {
  const existing = await prisma.candidateRoleMapping.findUnique({
    where: { id: mappingId },
    include: {
      candidate: { select: { fullName: true } },
      role: { select: { roleId: true, title: true } },
    },
  });

  if (!existing) throw new Error("Mapping not found");

  const [updated] = await prisma.$transaction([
    prisma.candidateRoleMapping.update({
      where: { id: mappingId },
      data: {
        status: newStatus,
        rejectionReason: newStatus === MappingStatus.Rejected ? (rejectionReason ?? null) : null,
        rejectionCustomReason:
          newStatus === MappingStatus.Rejected ? (rejectionCustomReason ?? null) : null,
      },
    }),
    prisma.activityLog.create({
      data: {
        userId,
        entityType: EntityType.Mapping,
        entityId: mappingId,
        oldValue: { status: existing.status },
        newValue: { status: newStatus },
        actionType: ActionType.Updated,
        description: `Status changed from ${existing.status} → ${newStatus} for ${existing.candidate.fullName} on ${existing.role.roleId}`,
      },
    }),
  ]);

  return updated;
}

export async function createMapping({
  candidateId,
  roleId,
  recruiterId,
  clientPoc,
  submissionDate,
  status,
  notes,
  userId,
}: {
  candidateId: string;
  roleId: string;
  recruiterId: string;
  clientPoc?: string;
  submissionDate?: Date;
  status?: MappingStatus;
  notes?: string;
  userId: string;
}) {
  const existing = await prisma.candidateRoleMapping.findUnique({
    where: { candidateId_roleId: { candidateId, roleId } },
  });

  if (existing) throw new Error("Candidate is already mapped to this role");

  const [mapping] = await prisma.$transaction([
    prisma.candidateRoleMapping.create({
      data: {
        candidateId,
        roleId,
        recruiterId,
        clientPoc,
        submissionDate: submissionDate ?? new Date(),
        status: status ?? MappingStatus.Submitted,
        notes,
      },
    }),
    prisma.activityLog.create({
      data: {
        userId,
        entityType: EntityType.Mapping,
        entityId: candidateId,
        actionType: ActionType.Created,
        newValue: { roleId, status: status ?? MappingStatus.Submitted },
        description: `Candidate mapped to role ${roleId}`,
      },
    }),
  ]);

  return mapping;
}

export async function getMappingsForKanban(roleId: string) {
  const mappings = await prisma.candidateRoleMapping.findMany({
    where: { roleId },
    include: {
      candidate: true,
      recruiter: { select: { id: true, name: true, email: true } },
      marginCalculation: true,
    },
    orderBy: { submissionDate: "asc" },
  });

  return mappings;
}

export async function logActivity({
  userId,
  entityType,
  entityId,
  oldValue,
  newValue,
  actionType,
  description,
}: {
  userId: string | null;
  entityType: EntityType;
  entityId: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  actionType: ActionType;
  description: string;
}) {
  return prisma.activityLog.create({
    data: {
      userId,
      entityType,
      entityId,
      oldValue: oldValue as Parameters<typeof prisma.activityLog.create>[0]["data"]["oldValue"],
      newValue: newValue as Parameters<typeof prisma.activityLog.create>[0]["data"]["newValue"],
      actionType,
      description,
    },
  });
}
