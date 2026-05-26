import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, unauthorizedResponse } from "@/lib/services/auth";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const clientId    = searchParams.get("clientId")    ?? "";
  const recruiterId = searchParams.get("recruiterId") ?? "";
  const priority    = searchParams.get("priority")    ?? "";

  const mappings = await prisma.candidateRoleMapping.findMany({
    where: {
      ...(clientId    ? { role: { clientId } }                              : {}),
      ...(recruiterId ? { recruiterId }                                     : {}),
      ...(priority    ? { role: { priority: priority as any } }             : {}),
    },
    select: {
      id:          true,
      status:      true,
      recruiterId: true,
      role: {
        select: {
          id:       true,
          roleId:   true,
          title:    true,
          status:   true,
          priority: true,
          client:   { select: { id: true, name: true } },
        },
      },
      recruiter: { select: { id: true, name: true } },
    },
  });

  // ── aggregate by (roleId, recruiterId) ─────────────────────────────────────
  type Row = {
    roleDbId:      string;
    roleId:        string;
    roleTitle:     string;
    roleStatus:    string;
    rolePriority:  string;
    clientId:      string;
    clientName:    string;
    recruiterId:   string;
    recruiterName: string;
    submitted:     number;
    interviews:    number;
    selected:      number;
    offered:       number;
    rejected:      number;
    onboarding:    number;
    withdrawn:     number;
  };

  const map = new Map<string, Row>();

  for (const m of mappings) {
    const key = `${m.role.id}__${m.recruiterId}`;
    if (!map.has(key)) {
      map.set(key, {
        roleDbId:      m.role.id,
        roleId:        m.role.roleId,
        roleTitle:     m.role.title,
        roleStatus:    m.role.status,
        rolePriority:  m.role.priority,
        clientId:      m.role.client.id,
        clientName:    m.role.client.name,
        recruiterId:   m.recruiter.id,
        recruiterName: m.recruiter.name,
        submitted:  0,
        interviews: 0,
        selected:   0,
        offered:    0,
        rejected:   0,
        onboarding: 0,
        withdrawn:  0,
      });
    }
    const row = map.get(key)!;
    const s = m.status;
    row.submitted++;
    if (s === "R1" || s === "R2" || s === "ClientRound") row.interviews++;
    if (s === "Selected")                                 row.selected++;
    if (s === "Offered"  || s === "Accepted")             row.offered++;
    if (s === "Rejected")                                 row.rejected++;
    if (s === "Onboarding")                               row.onboarding++;
    if (s === "CandidateWithdrawn")                       row.withdrawn++;
  }

  const rows = Array.from(map.values()).sort((a, b) =>
    a.clientName.localeCompare(b.clientName) ||
    a.roleId.localeCompare(b.roleId) ||
    a.recruiterName.localeCompare(b.recruiterName)
  );

  // ── summary totals ──────────────────────────────────────────────────────────
  const summary = rows.reduce(
    (acc, r) => ({
      submitted:  acc.submitted  + r.submitted,
      interviews: acc.interviews + r.interviews,
      selected:   acc.selected   + r.selected,
      offered:    acc.offered    + r.offered,
      rejected:   acc.rejected   + r.rejected,
    }),
    { submitted: 0, interviews: 0, selected: 0, offered: 0, rejected: 0 }
  );

  // ── filter options ──────────────────────────────────────────────────────────
  const clients = await prisma.client.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const recruiters = await prisma.user.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ rows, summary, clients, recruiters });
}
