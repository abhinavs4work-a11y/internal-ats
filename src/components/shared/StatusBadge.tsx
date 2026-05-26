import { MappingStatus, RoleStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

const MAPPING_STATUS_CONFIG: Record<MappingStatus, {
  label: string;
  bg: string;
  text: string;
  dot: string;
}> = {
  Submitted:         { label: "Submitted",     bg: "bg-slate-100",        text: "text-slate-600",   dot: "bg-slate-400" },
  R1:                { label: "R1",            bg: "bg-blue-50",          text: "text-blue-700",    dot: "bg-blue-400" },
  R2:                { label: "R2",            bg: "bg-indigo-50",        text: "text-indigo-700",  dot: "bg-indigo-400" },
  ClientRound:       { label: "Client Round",  bg: "bg-violet-50",        text: "text-violet-700",  dot: "bg-violet-400" },
  Selected:          { label: "Selected",      bg: "bg-green-50",         text: "text-green-700",   dot: "bg-green-400" },
  Offered:           { label: "Offered",       bg: "bg-emerald-50",       text: "text-emerald-700", dot: "bg-emerald-400" },
  Accepted:          { label: "Accepted",      bg: "bg-teal-50",          text: "text-teal-700",    dot: "bg-teal-400" },
  Onboarding:        { label: "Onboarding",    bg: "bg-cyan-50",          text: "text-cyan-700",    dot: "bg-cyan-400" },
  Rejected:          { label: "Rejected",      bg: "bg-red-50",           text: "text-red-600",     dot: "bg-red-400" },
  CandidateWithdrawn:{ label: "Withdrawn",     bg: "bg-orange-50",        text: "text-orange-600",  dot: "bg-orange-400" },
};

const ROLE_STATUS_CONFIG: Record<RoleStatus, {
  label: string;
  bg: string;
  text: string;
  dot: string;
  ring: string;
}> = {
  Active:   { label: "Active",   bg: "bg-emerald-50",  text: "text-emerald-700", dot: "bg-emerald-400", ring: "ring-emerald-200/60" },
  OnHold:   { label: "On Hold",  bg: "bg-amber-50",    text: "text-amber-700",   dot: "bg-amber-400",   ring: "ring-amber-200/60" },
  Inactive: { label: "Inactive", bg: "bg-slate-100",   text: "text-slate-500",   dot: "bg-slate-400",   ring: "ring-slate-200/60" },
  Closed:   { label: "Closed",   bg: "bg-rose-50",     text: "text-rose-600",    dot: "bg-rose-400",    ring: "ring-rose-200/60" },
};

export function MappingStatusBadge({ status }: { status: MappingStatus }) {
  const c = MAPPING_STATUS_CONFIG[status];
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide ring-1 ring-inset ring-black/5",
      c.bg, c.text
    )}>
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", c.dot)} />
      {c.label}
    </span>
  );
}

export function RoleStatusBadge({ status }: { status: RoleStatus }) {
  const c = ROLE_STATUS_CONFIG[status];
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide ring-1 ring-inset",
      c.bg, c.text, c.ring
    )}>
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0 animate-none", c.dot,
        status === "Active" ? "shadow-[0_0_4px_1px] shadow-emerald-400/60" : ""
      )} />
      {c.label}
    </span>
  );
}

export const MAPPING_STATUS_LABELS: Record<MappingStatus, string> = Object.fromEntries(
  Object.entries(MAPPING_STATUS_CONFIG).map(([k, v]) => [k, v.label])
) as Record<MappingStatus, string>;
