import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, unauthorizedResponse } from "@/lib/services/auth";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  const { id } = await params;

  const mappings = await prisma.candidateRoleMapping.findMany({
    where: { candidateId: id },
    include: {
      role: { include: { client: { select: { id: true, name: true } } } },
      recruiter: { select: { id: true, name: true } },
      marginCalculation: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(mappings);
}
