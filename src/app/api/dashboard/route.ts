import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, unauthorizedResponse } from "@/lib/services/auth";
import { MappingStatus, RoleStatus } from "@prisma/client";

const TERMINAL_STATUSES: MappingStatus[] = [
  MappingStatus.Rejected,
  MappingStatus.CandidateWithdrawn,
];

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const recruiterId = searchParams.get("recruiterId");
  const clientId = searchParams.get("clientId");

  const roleWhere = {
    ...(clientId ? { clientId } : {}),
    ...(recruiterId ? { recruiters: { some: { recruiterId } } } : {}),
  };

  const mappingWhere = {
    ...(recruiterId ? { recruiterId } : {}),
    ...(clientId ? { role: { clientId } } : {}),
  };

  const [activeRoles, totalActiveProfiles, filledRoles] = await Promise.all([
    // Active roles count
    prisma.role.count({
      where: { status: RoleStatus.Active, ...roleWhere },
    }),

    // Total active profiles (not in terminal statuses)
    prisma.candidateRoleMapping.count({
      where: {
        status: { notIn: TERMINAL_STATUSES },
        ...mappingWhere,
      },
    }),

    // Roles that have at least one "Selected" candidate (for time to fill)
    prisma.role.findMany({
      where: {
        mappings: {
          some: { status: MappingStatus.Selected },
        },
        ...roleWhere,
      },
      select: {
        id: true,
        roleId: true,
        title: true,
        createdDate: true,
        client: { select: { name: true } },
        mappings: {
          where: { status: MappingStatus.Selected },
          orderBy: { updatedAt: "asc" },
          take: 1,
          select: { updatedAt: true },
        },
      },
    }),
  ]);

  // Calculate time to fill per role
  const roleWiseTimeToFill = filledRoles
    .filter((r) => r.mappings.length > 0)
    .map((r) => {
      const selectedAt = r.mappings[0].updatedAt;
      const daysToFill = Math.round(
        (selectedAt.getTime() - r.createdDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        roleId: r.roleId,
        roleTitle: r.title,
        clientName: r.client.name,
        daysToFill,
      };
    });

  const avgTimeToFill =
    roleWiseTimeToFill.length > 0
      ? Math.round(
          roleWiseTimeToFill.reduce((sum, r) => sum + r.daysToFill, 0) /
            roleWiseTimeToFill.length
        )
      : null;

  return NextResponse.json({
    activeRoles,
    totalActiveProfiles,
    avgTimeToFill,
    roleWiseTimeToFill,
  });
}
