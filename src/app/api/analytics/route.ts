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

  // Start from Role so zero-candidate roles still appear
  const roles = await prisma.role.findMany({
    where: {
      status: { not: "Closed" },
      ...(clientId   ? { clientId }                : {}),
      ...(priority   ? { priority: priority as any } : {}),
      ...(recruiterId ? {
        OR: [
          { recruiters: { some: { recruiterId } } },
          { mappings:   { some: { recruiterId } } },
        ],
      } : {}),
    },
    select: {
      id:       true,
      roleId:   true,
      title:    true,
      status:   true,
      priority: true,
      client:   { select: { id: true, name: true } },
      recruiters: {
        select: { recruiter: { select: { id: true, name: true } } },
      },
      mappings: {
        ...(recruiterId ? { where: { recruiterId } } : {}),
        select: {
          status:      true,
          recruiterId: true,
          recruiter:   { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [{ client: { name: "asc" } }, { roleId: "asc" }],
  });

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

  function zeroRow(role: typeof roles[0], recruiterId: string, recruiterName: string): Row {
    return {
      roleDbId:      role.id,
      roleId:        role.roleId,
      roleTitle:     role.title,
      roleStatus:    role.status,
      rolePriority:  role.priority,
      clientId:      role.client.id,
      clientName:    role.client.name,
      recruiterId,
      recruiterName,
      submitted:  0,
      interviews: 0,
      selected:   0,
      offered:    0,
      rejected:   0,
      onboarding: 0,
      withdrawn:  0,
    };
  }

  const allRows: Row[] = [];

  for (const role of roles) {
    // Aggregate existing mappings by recruiterId
    const mappingMap = new Map<string, Row>();

    for (const m of role.mappings) {
      if (!mappingMap.has(m.recruiterId)) {
        mappingMap.set(m.recruiterId, zeroRow(role, m.recruiter.id, m.recruiter.name));
      }
      const row = mappingMap.get(m.recruiterId)!;
      const s = m.status;
      row.submitted++;
      if (s === "R1" || s === "R2" || s === "ClientRound") row.interviews++;
      if (s === "Selected")                                row.selected++;
      if (s === "Offered"  || s === "Accepted")            row.offered++;
      if (s === "Rejected")                                row.rejected++;
      if (s === "Onboarding")                              row.onboarding++;
      if (s === "CandidateWithdrawn")                      row.withdrawn++;
    }

    if (mappingMap.size > 0) {
      // Role has submissions — show per-recruiter rows as before
      allRows.push(...Array.from(mappingMap.values()));
    } else {
      // No submissions yet — show one zero row per assigned recruiter
      if (role.recruiters.length > 0) {
        for (const rr of role.recruiters) {
          allRows.push(zeroRow(role, rr.recruiter.id, rr.recruiter.name));
        }
      } else {
        // No recruiters assigned either — still surface the role
        allRows.push(zeroRow(role, "", "Unassigned"));
      }
    }
  }

  allRows.sort((a, b) =>
    a.clientName.localeCompare(b.clientName) ||
    a.roleId.localeCompare(b.roleId) ||
    a.recruiterName.localeCompare(b.recruiterName)
  );

  const summary = allRows.reduce(
    (acc, r) => ({
      submitted:  acc.submitted  + r.submitted,
      interviews: acc.interviews + r.interviews,
      selected:   acc.selected   + r.selected,
      offered:    acc.offered    + r.offered,
      rejected:   acc.rejected   + r.rejected,
    }),
    { submitted: 0, interviews: 0, selected: 0, offered: 0, rejected: 0 }
  );

  const clients = await prisma.client.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const recruiters = await prisma.user.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ rows: allRows, summary, clients, recruiters });
}
