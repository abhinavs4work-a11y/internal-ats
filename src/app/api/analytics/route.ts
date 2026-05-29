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
  const poc         = searchParams.get("poc")         ?? "";

  // Filter by role owner (RoleRecruiter), not by mapping submitter
  const roles = await prisma.role.findMany({
    where: {
      ...(clientId    ? { clientId }                                        : {}),
      ...(priority    ? { priority: priority as any }                      : {}),
      ...(poc         ? { poc: { path: ["name"], equals: poc } }           : {}),
      ...(recruiterId ? { recruiters: { some: { recruiterId } } }          : {}),
    },
    select: {
      id:       true,
      roleId:   true,
      title:    true,
      status:   true,
      priority: true,
      poc:      true,
      client:   { select: { id: true, name: true } },
      // Role's assigned owners — shown in the Owner column
      recruiters: {
        select: { recruiter: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
      // All mappings for this role regardless of who submitted them
      mappings: {
        select: { status: true },
      },
    },
    orderBy: [{ client: { name: "asc" } }, { roleId: "asc" }],
  });

  type Owner = { id: string; name: string };

  type Row = {
    roleDbId:      string;
    roleId:        string;
    roleTitle:     string;
    roleStatus:    string;
    rolePriority:  string;
    clientId:      string;
    clientName:    string;
    pocName:       string;
    owners:        Owner[];   // role's assigned recruiters
    recruiterId:   string;    // kept for breakdown tooltip (empty = all)
    recruiterName: string;    // display string
    submitted:     number;
    interviews:    number;
    selected:      number;
    offered:       number;
    rejected:      number;
    onboarding:    number;
    onboarded:     number;
    withdrawn:     number;
  };

  const allRows: Row[] = [];

  for (const role of roles) {
    const pocRaw = role.poc as { name?: string } | null;
    const owners: Owner[] = role.recruiters.map((rr) => rr.recruiter);

    // Aggregate ALL mappings for this role (regardless of who submitted)
    const stats = {
      submitted: 0, interviews: 0, selected: 0, offered: 0,
      rejected: 0, onboarding: 0, onboarded: 0, withdrawn: 0,
    };

    for (const m of role.mappings) {
      const s = m.status;
      stats.submitted++;
      if (s === "R1" || s === "R2" || s === "ClientRound") stats.interviews++;
      if (s === "Selected")                                stats.selected++;
      if (s === "Offered"  || s === "Accepted")            stats.offered++;
      if (s === "Rejected")                                stats.rejected++;
      if (s === "Onboarding")                              stats.onboarding++;
      if (s === "Onboarded")                               stats.onboarded++;
      if (s === "CandidateWithdrawn")                      stats.withdrawn++;
    }

    allRows.push({
      roleDbId:      role.id,
      roleId:        role.roleId,
      roleTitle:     role.title,
      roleStatus:    role.status,
      rolePriority:  role.priority,
      clientId:      role.client.id,
      clientName:    role.client.name,
      pocName:       pocRaw?.name ?? "",
      owners,
      recruiterId:   "",   // all recruiters — breakdown API handles empty = no filter
      recruiterName: owners.length > 0
        ? owners.map((o) => o.name.split(" ")[0]).join(", ")
        : "Unassigned",
      ...stats,
    });
  }

  allRows.sort((a, b) =>
    a.clientName.localeCompare(b.clientName) ||
    a.roleId.localeCompare(b.roleId)
  );

  const summary = allRows.reduce(
    (acc, r) => ({
      submitted:  acc.submitted  + r.submitted,
      interviews: acc.interviews + r.interviews,
      selected:   acc.selected   + r.selected,
      offered:    acc.offered    + r.offered,
      rejected:   acc.rejected   + r.rejected,
      onboarded:  acc.onboarded  + r.onboarded,
    }),
    { submitted: 0, interviews: 0, selected: 0, offered: 0, rejected: 0, onboarded: 0 }
  );

  const clients = await prisma.client.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const recruiters = await prisma.user.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const allRolesForPoc = await prisma.role.findMany({
    select: { poc: true },
  });
  const pocs = [
    ...new Set(
      allRolesForPoc
        .map((r) => (r.poc as { name?: string } | null)?.name)
        .filter((n): n is string => !!n)
    ),
  ].sort();

  return NextResponse.json({ rows: allRows, summary, clients, recruiters, pocs });
}
