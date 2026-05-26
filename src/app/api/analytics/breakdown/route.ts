import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, unauthorizedResponse } from "@/lib/services/auth";
import { MappingStatus } from "@prisma/client";

const CATEGORY_STATUSES: Record<string, MappingStatus[]> = {
  submitted:  [
    "Submitted", "R1", "R2", "ClientRound",
    "Selected", "Offered", "Accepted",
    "Onboarding", "Rejected", "CandidateWithdrawn",
  ],
  interviews: ["R1", "R2", "ClientRound"],
  selected:   ["Selected"],
  offered:    ["Offered", "Accepted"],
  rejected:   ["Rejected"],
};

const STATUS_LABEL: Record<string, string> = {
  Submitted:         "Submitted",
  R1:                "R1",
  R2:                "R2",
  ClientRound:       "Client Round",
  Selected:          "Selected",
  Offered:           "Offered",
  Accepted:          "Accepted",
  Onboarding:        "Onboarding",
  Rejected:          "Rejected",
  CandidateWithdrawn:"Withdrawn",
};

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const roleId      = searchParams.get("roleId");
  const recruiterId = searchParams.get("recruiterId");
  const category    = searchParams.get("category") ?? "submitted";

  if (!roleId || !recruiterId) {
    return NextResponse.json({ error: "roleId and recruiterId are required" }, { status: 400 });
  }

  const statuses = CATEGORY_STATUSES[category];
  if (!statuses) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const mappings = await prisma.candidateRoleMapping.findMany({
    where: {
      roleId,
      recruiterId,
      status: { in: statuses },
    },
    select: {
      status: true,
      candidate: { select: { fullName: true } },
    },
    orderBy: { submissionDate: "desc" },
  });

  const candidates = mappings.map((m) => ({
    name:  m.candidate.fullName,
    stage: STATUS_LABEL[m.status] ?? m.status,
  }));

  return NextResponse.json(candidates);
}
