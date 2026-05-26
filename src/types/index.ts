export type {
  User,
  Client,
  Role,
  RoleRecruiter,
  Candidate,
  CandidateRoleMapping,
  MarginCalculation,
  ActivityLog,
} from "@prisma/client";

export {
  UserRole,
  RolePriority,
  RoleStatus,
  CandidateSource,
  MappingStatus,
  RejectionReason,
  EntityType,
  ActionType,
} from "@prisma/client";

// ─── Extended types with relations ───────────────────────────────────────────

import type {
  User,
  Client,
  Role,
  Candidate,
  CandidateRoleMapping,
  MarginCalculation,
  ActivityLog,
} from "@prisma/client";

export type ClientPoc = { name: string; email: string };

export type ClientWithRoles = Client & {
  _count: { roles: number };
  roles: Array<{ id: string; roleId: string; title: string; status: string; openings: number }>;
};

/** @deprecated use ClientWithRoles */
export type ClientWithRoleCount = ClientWithRoles;

export type RoleWithClient = Role & {
  client: Client;
  recruiters: Array<{ recruiter: User }>;
  _count: { mappings: number };
};

export type CandidateWithMappings = Candidate & {
  mappings: Array<
    CandidateRoleMapping & {
      role: Role & { client: Client };
      recruiter: User;
    }
  >;
  owner: Pick<User, "id" | "name"> | null;
};

export type MappingWithDetails = CandidateRoleMapping & {
  candidate: Candidate;
  role: Role & { client: Client };
  recruiter: User;
  marginCalculation: MarginCalculation | null;
};

export type KanbanColumn = {
  status: string;
  label: string;
  cards: MappingWithDetails[];
};

export type ActivityLogWithUser = ActivityLog & {
  user: User | null;
};

// ─── Margin Calculator types ──────────────────────────────────────────────────

export type MarginInputs = {
  ectc: number;
  contingencyPercentage: number;
  agencyMarkupPercentage: number;
  avkalanMarkupPercentage: number;
  passThrough: number;
  buyout: number;
};

export type MarginResults = MarginInputs & {
  contingencyAmount: number;
  agencyMarkupAmount: number;
  avkalanMarkupAmount: number;
  passThroughAmount: number;
  totalCost: number;
  dailyRate: number;
  monthlyRate: number;
};

// ─── Dashboard types ──────────────────────────────────────────────────────────

export type DashboardStats = {
  activeRoles: number;
  totalActiveProfiles: number;
  avgTimeToFill: number | null;
  roleWiseTimeToFill: Array<{
    roleId: string;
    roleTitle: string;
    clientName: string;
    daysToFill: number;
  }>;
};

// ─── Search types ─────────────────────────────────────────────────────────────

export type SearchResult = {
  candidates: Array<Pick<Candidate, "id" | "candidateId" | "fullName" | "email" | "phone">>;
  roles: Array<Pick<Role, "id" | "roleId" | "title"> & { client: Pick<Client, "name"> }>;
  clients: Array<Pick<Client, "id" | "clientId" | "name">>;
};

// ─── Bulk upload types ────────────────────────────────────────────────────────

export type BulkUploadRow = {
  candidateName?: string;
  email?: string;
  phone?: string;
  currentCtc?: string;
  expectedCtc?: string;
  source?: string;
  recruiter?: string;
  roleId?: string;
  status?: string;
  submissionDate?: string;
  notes?: string;
};

export type BulkUploadResult = {
  row: number;
  status: "success" | "duplicate" | "error";
  message: string;
  candidateName?: string;
  email?: string;
};

export type BulkUploadRoleRow = {
  title?: string;
  clientName?: string;
  budget?: string;
  openings?: string;
  locations?: string;       // comma-separated
  priority?: string;        // High | Medium | Low
  status?: string;          // Active | OnHold | Inactive | Closed
  recruiters?: string;      // comma-separated recruiter names
  jd?: string;
};

export type BulkUploadRoleResult = {
  row: number;
  status: "success" | "error";
  message: string;
  roleTitle?: string;
  roleId?: string;
  clientName?: string;
};
