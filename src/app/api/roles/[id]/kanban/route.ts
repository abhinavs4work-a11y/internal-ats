import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, unauthorizedResponse } from "@/lib/services/auth";
import { MappingStatus } from "@prisma/client";

const DEFAULT_STAGES: MappingStatus[] = [
  MappingStatus.Submitted,
  MappingStatus.R1,
  MappingStatus.R2,
  MappingStatus.ClientRound,
  MappingStatus.Selected,
  MappingStatus.Offered,
  MappingStatus.Accepted,
  MappingStatus.Onboarding,
  MappingStatus.Rejected,
  MappingStatus.CandidateWithdrawn,
];

export const STAGE_LABELS: Record<MappingStatus, string> = {
  Submitted: "Submitted",
  R1: "R1",
  R2: "R2",
  ClientRound: "Client Round",
  Selected: "Selected",
  Offered: "Offered",
  Accepted: "Accepted",
  Onboarding: "Onboarding",
  Rejected: "Rejected",
  CandidateWithdrawn: "Candidate Withdrawn",
};

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  const { id } = await params;

  const mappings = await prisma.candidateRoleMapping.findMany({
    where: { roleId: id },
    include: {
      candidate: true,
      recruiter: { select: { id: true, name: true } },
      marginCalculation: true,
    },
    orderBy: { submissionDate: "asc" },
  });

  // Group by status
  const columns = DEFAULT_STAGES.map((status) => ({
    status,
    label: STAGE_LABELS[status],
    cards: mappings.filter((m) => m.status === status),
  }));

  return NextResponse.json(columns);
}
