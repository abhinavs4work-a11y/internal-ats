import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, unauthorizedResponse } from "@/lib/services/auth";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json({ candidates: [], roles: [], clients: [] });
  }

  const [candidates, roles, clients] = await Promise.all([
    prisma.candidate.findMany({
      where: {
        OR: [
          { fullName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
          { candidateId: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, candidateId: true, fullName: true, email: true, phone: true },
      take: 5,
    }),
    prisma.role.findMany({
      where: {
        OR: [
          { roleId: { contains: q, mode: "insensitive" } },
          { title: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        roleId: true,
        title: true,
        client: { select: { name: true } },
      },
      take: 5,
    }),
    prisma.client.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { clientId: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, clientId: true, name: true },
      take: 5,
    }),
  ]);

  return NextResponse.json({ candidates, roles, clients });
}
