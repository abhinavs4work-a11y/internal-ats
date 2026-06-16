"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, Users, CheckCircle2, XCircle, Briefcase, Award, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

type AnalyticsRow = {
  roleDbId:      string;
  roleId:        string;
  roleTitle:     string;
  roleStatus:    string;
  rolePriority:  string;
  clientId:      string;
  clientName:    string;
  pocName:       string;
  owners:        { id: string; name: string }[];
  recruiterId:   string;
  recruiterName: string;
  submitted:     number;
  interviews:    number;
  selected:      number;
  offered:       number;
  rejected:      number;
  onboarding:    number;
  onboarded:     number;
  withdrawn:     number;
};

type AnalyticsData = {
  rows:       AnalyticsRow[];
  summary:    { submitted: number; interviews: number; selected: number; offered: number; rejected: number; onboarded: number };
  clients:    { id: string; name: string }[];
  recruiters: { id: string; name: string }[];
  pocs:       string[];
};

function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: number; icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
      <div className={cn("p-2.5 rounded-lg", color)}>
        <Icon size={18} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function Pct({ num, den }: { num: number; den: number }) {
  if (!den) return <span className="text-slate-300">—</span>;
  const pct = Math.round((num / den) * 100);
  return <span className="text-xs text-slate-400 ml-1">({pct}%)</span>;
}

// ─── Hover tooltip for stat cells ─────────────────────────────────────────────
type TooltipCandidate = { name: string; stage: string };

function StatCell({
  value,
  highlight,
  showPct,
  submitted,
  roleDbId,
  recruiterId,
  category,
}: {
  value:       number;
  highlight?:  string;
  showPct?:    boolean;
  submitted?:  number;
  roleDbId:    string;
  recruiterId: string;
  category:    string;
}) {
  const [open,       setOpen]       = useState(false);
  const [pos,        setPos]        = useState({ top: 0, left: 0 });
  const [candidates, setCandidates] = useState<TooltipCandidate[] | null>(null);
  const [loading,    setLoading]    = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchCandidates = useCallback(async () => {
    if (candidates !== null) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/analytics/breakdown?roleId=${roleDbId}&recruiterId=${recruiterId}&category=${category}`
      );
      const data = await res.json();
      setCandidates(data);
    } catch {
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }, [candidates, roleDbId, recruiterId, category]);

  function handleMouseEnter() {
    if (!value) return;
    timerRef.current = setTimeout(() => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) {
        setPos({
          top:  rect.bottom + window.scrollY + 6,
          left: rect.left   + window.scrollX + rect.width / 2,
        });
      }
      fetchCandidates();
      setOpen(true);
    }, 180);
  }

  function handleMouseLeave() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, { passive: true });
    return () => window.removeEventListener("scroll", close);
  }, [open]);

  if (!value) {
    return (
      <div className="flex items-center justify-center">
        <span className="text-slate-300">—</span>
        {showPct && submitted ? <Pct num={0} den={submitted} /> : null}
      </div>
    );
  }

  return (
    <>
      <div
        ref={triggerRef}
        className="inline-flex items-center justify-center gap-0.5 cursor-default select-none"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <span className={cn(
          "font-medium tabular-nums underline decoration-dotted underline-offset-2 decoration-slate-300",
          highlight ?? "text-slate-700"
        )}>
          {value}
        </span>
        {showPct && submitted !== undefined && (
          <Pct num={value} den={submitted} />
        )}
      </div>

      {open && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ top: pos.top, left: pos.left, transform: "translateX(-50%)" }}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={handleMouseLeave}
        >
          <div className="bg-slate-900 text-white rounded-lg shadow-xl text-xs min-w-[180px] max-w-[260px] overflow-hidden">
            {loading ? (
              <div className="px-3 py-2.5 text-slate-400">Loading…</div>
            ) : !candidates?.length ? (
              <div className="px-3 py-2.5 text-slate-400">No candidates</div>
            ) : (
              <>
                <div className="grid grid-cols-[1fr_auto] gap-x-4 px-3 py-1.5 bg-slate-800 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                  <span>Candidate</span><span>Stage</span>
                </div>
                <div className="divide-y divide-slate-800 max-h-52 overflow-y-auto">
                  {candidates.map((c, i) => (
                    <div key={i} className="grid grid-cols-[1fr_auto] gap-x-4 px-3 py-1.5">
                      <span className="font-medium text-white truncate">{c.name}</span>
                      <span className="text-slate-400 whitespace-nowrap">{c.stage}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-1.5 overflow-hidden">
            <div className="w-2.5 h-2.5 bg-slate-900 rotate-45 translate-y-1 mx-auto" />
          </div>
        </div>
      )}
    </>
  );
}

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  High:   { label: "High",   className: "bg-red-100 text-red-700"       },
  Medium: { label: "Medium", className: "bg-yellow-100 text-yellow-700" },
  Low:    { label: "Low",    className: "bg-slate-100 text-slate-500"   },
};

// Shared grid template for all rows
const GRID = "grid-cols-[2fr_1.5fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr]";

export default function AnalyticsPage() {
  const [clientId,    setClientId]    = useState("all");
  const [recruiterId, setRecruiterId] = useState("all");
  const [priority,    setPriority]    = useState("all");
  const [poc,         setPoc]         = useState("all");

  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["analytics", clientId, recruiterId, priority, poc],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (clientId    !== "all") params.set("clientId",    clientId);
      if (recruiterId !== "all") params.set("recruiterId", recruiterId);
      if (priority    !== "all") params.set("priority",    priority);
      if (poc         !== "all") params.set("poc",         poc);
      const res = await fetch(`/api/analytics?${params}`);
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const rows       = data?.rows       ?? [];
  const summary    = data?.summary    ?? { submitted: 0, interviews: 0, selected: 0, offered: 0, rejected: 0, onboarded: 0 };
  const clients    = data?.clients    ?? [];
  const recruiters = data?.recruiters ?? [];
  const pocs       = data?.pocs       ?? [];

  const grouped = rows.reduce<Record<string, AnalyticsRow[]>>((acc, row) => {
    const key = row.roleDbId;
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
        <p className="text-slate-500 text-sm mt-1">Recruitment pipeline overview by role &amp; owner</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select value={clientId} onValueChange={setClientId}>
          <SelectTrigger className="w-44 bg-white"><SelectValue placeholder="All Clients" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={recruiterId} onValueChange={setRecruiterId}>
          <SelectTrigger className="w-44 bg-white"><SelectValue placeholder="All Owners" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Owners</SelectItem>
            {recruiters.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-40 bg-white"><SelectValue placeholder="All Priorities" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="High">High</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="Low">Low</SelectItem>
          </SelectContent>
        </Select>

        <Select value={poc} onValueChange={setPoc}>
          <SelectTrigger className="w-44 bg-white"><SelectValue placeholder="All POCs" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All POCs</SelectItem>
            {pocs.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Submitted"  value={summary.submitted}  icon={Users}       color="bg-slate-500"   />
        <StatCard label="Interviews" value={summary.interviews} icon={Briefcase}   color="bg-blue-500"    />
        <StatCard label="Selected"   value={summary.selected}   icon={CheckCircle2}color="bg-green-500"   />
        <StatCard label="Offered"    value={summary.offered}    icon={Award}       color="bg-emerald-500" />
        <StatCard label="Onboarded"  value={summary.onboarded}  icon={UserCheck}   color="bg-sky-500"     />
        <StatCard label="Rejected"   value={summary.rejected}   icon={XCircle}     color="bg-red-500"     />
      </div>

      {/* Table — desktop only */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className={cn("grid gap-px bg-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide", GRID)}>
          <div className="bg-slate-50 px-4 py-3">Role</div>
          <div className="bg-slate-50 px-4 py-3">Owner</div>
          <div className="bg-slate-50 px-3 py-3 text-center">Submitted</div>
          <div className="bg-slate-50 px-3 py-3 text-center">Interviews</div>
          <div className="bg-slate-50 px-3 py-3 text-center">Selected</div>
          <div className="bg-slate-50 px-3 py-3 text-center">Offered</div>
          <div className="bg-slate-50 px-3 py-3 text-center">Onboarded</div>
          <div className="bg-slate-50 px-3 py-3 text-center">Rejected</div>
          <div className="bg-slate-50 px-3 py-3 text-center">Conversion</div>
        </div>

        {isLoading ? (
          <div className="space-y-px bg-slate-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={cn("grid gap-px bg-slate-100", GRID)}>
                {Array.from({ length: 9 }).map((_, j) => (
                  <div key={j} className="bg-white px-4 py-3.5">
                    <div className="h-3.5 bg-slate-100 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <BarChart3 size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No data yet. Add candidates to roles to see analytics.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {Object.entries(grouped).map(([roleDbId, roleRows]) => {
              const first = roleRows[0];
              const multiRecruiter = roleRows.length > 1;

              const roleTotals = multiRecruiter
                ? roleRows.reduce(
                    (acc, r) => ({
                      submitted:  acc.submitted  + r.submitted,
                      interviews: acc.interviews + r.interviews,
                      selected:   acc.selected   + r.selected,
                      offered:    acc.offered    + r.offered,
                      onboarded:  acc.onboarded  + r.onboarded,
                      rejected:   acc.rejected   + r.rejected,
                    }),
                    { submitted: 0, interviews: 0, selected: 0, offered: 0, onboarded: 0, rejected: 0 }
                  )
                : null;

              return (
                <div key={roleDbId} className="divide-y divide-slate-50">
                  {roleRows.map((row, idx) => (
                    <div key={`${roleDbId}-${row.recruiterId}`} className={cn("grid gap-px bg-slate-100", GRID)}>
                      {/* Role info */}
                      <div className="bg-white px-4 py-3 flex items-center">
                        {idx === 0 ? (
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-mono text-slate-400">{first.roleId}</span>
                              <span className={cn(
                                "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                                first.roleStatus === "Active"  ? "bg-green-100 text-green-700"   :
                                first.roleStatus === "OnHold"  ? "bg-yellow-100 text-yellow-700" :
                                first.roleStatus === "Closed"  ? "bg-red-100 text-red-700"       :
                                "bg-slate-100 text-slate-500"
                              )}>
                                {first.roleStatus}
                              </span>
                              {PRIORITY_CONFIG[first.rolePriority] && (
                                <span className={cn(
                                  "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                                  PRIORITY_CONFIG[first.rolePriority].className
                                )}>
                                  {PRIORITY_CONFIG[first.rolePriority].label}
                                </span>
                              )}
                            </div>
                            <Link
                              href={`/roles/${first.roleDbId}/kanban`}
                              className="text-sm font-semibold text-slate-900 hover:text-blue-600 hover:underline mt-0.5 leading-tight block"
                            >
                              {first.roleTitle}
                            </Link>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <p className="text-xs text-slate-400">{first.clientName}</p>
                              {first.pocName && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-600">
                                  {first.pocName.split(" ")[0]}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 pl-2">
                            <div className="w-px h-4 bg-slate-200" />
                            <span className="text-xs text-slate-300 font-mono truncate">{first.roleId}</span>
                          </div>
                        )}
                      </div>

                      {/* Owner */}
                      <div className="bg-white px-4 py-3 flex items-center gap-2">
                        {row.owners.length === 0 ? (
                          <span className="text-sm text-slate-400 italic">Unassigned</span>
                        ) : (
                          <>
                            <div className="flex -space-x-1.5 shrink-0">
                              {row.owners.slice(0, 3).map((o) => (
                                <div
                                  key={o.id}
                                  title={o.name}
                                  className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center ring-2 ring-white"
                                >
                                  {o.name.charAt(0).toUpperCase()}
                                </div>
                              ))}
                            </div>
                            <span className="text-sm text-slate-700 font-medium truncate">
                              {row.owners.length === 1
                                ? row.owners[0].name.split(" ")[0]
                                : row.owners.slice(0, 2).map((o) => o.name.split(" ")[0]).join(", ")
                                  + (row.owners.length > 2 ? ` +${row.owners.length - 2}` : "")}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Stats */}
                      <div className="bg-white px-3 py-3 text-center flex items-center justify-center">
                        <StatCell value={row.submitted} roleDbId={row.roleDbId} recruiterId={row.recruiterId} category="submitted" />
                      </div>
                      <div className="bg-white px-3 py-3 text-center flex items-center justify-center">
                        <StatCell value={row.interviews} highlight="text-blue-600" showPct submitted={row.submitted} roleDbId={row.roleDbId} recruiterId={row.recruiterId} category="interviews" />
                      </div>
                      <div className="bg-white px-3 py-3 text-center flex items-center justify-center">
                        <StatCell value={row.selected} highlight="text-green-600" showPct submitted={row.submitted} roleDbId={row.roleDbId} recruiterId={row.recruiterId} category="selected" />
                      </div>
                      <div className="bg-white px-3 py-3 text-center flex items-center justify-center">
                        <StatCell value={row.offered} highlight="text-emerald-600" showPct submitted={row.submitted} roleDbId={row.roleDbId} recruiterId={row.recruiterId} category="offered" />
                      </div>
                      <div className="bg-white px-3 py-3 text-center flex items-center justify-center">
                        <StatCell value={row.onboarded} highlight="text-sky-600" showPct submitted={row.submitted} roleDbId={row.roleDbId} recruiterId={row.recruiterId} category="onboarded" />
                      </div>
                      <div className="bg-white px-3 py-3 text-center flex items-center justify-center">
                        <StatCell value={row.rejected} highlight="text-red-500" showPct submitted={row.submitted} roleDbId={row.roleDbId} recruiterId={row.recruiterId} category="rejected" />
                      </div>
                      <div className="bg-white px-3 py-3 text-center flex items-center justify-center">
                        {row.submitted > 0 ? (
                          <div className="flex flex-col items-center gap-1 w-full">
                            <span className="text-xs font-semibold text-slate-600">
                              {Math.round((row.selected / row.submitted) * 100)}%
                            </span>
                            <div className="w-full max-w-[48px] h-1 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-400 rounded-full"
                                style={{ width: `${Math.min(100, Math.round((row.selected / row.submitted) * 100))}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Multi-recruiter total row */}
                  {multiRecruiter && roleTotals && (
                    <div className={cn("grid gap-px bg-slate-200", GRID)}>
                      <div className="bg-slate-50 px-4 py-2 flex items-center">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide pl-2">
                          {first.roleId} total
                        </span>
                      </div>
                      <div className="bg-slate-50 px-4 py-2 flex items-center">
                        <span className="text-xs text-slate-400 italic">{roleRows.length} owners</span>
                      </div>
                      <div className="bg-slate-50 px-3 py-2 text-center flex items-center justify-center">
                        <span className="text-sm font-semibold text-slate-600">{roleTotals.submitted || "—"}</span>
                      </div>
                      <div className="bg-slate-50 px-3 py-2 text-center flex items-center justify-center">
                        <span className="text-sm font-semibold text-blue-600">{roleTotals.interviews || "—"}</span>
                      </div>
                      <div className="bg-slate-50 px-3 py-2 text-center flex items-center justify-center">
                        <span className="text-sm font-semibold text-green-600">{roleTotals.selected || "—"}</span>
                      </div>
                      <div className="bg-slate-50 px-3 py-2 text-center flex items-center justify-center">
                        <span className="text-sm font-semibold text-emerald-600">{roleTotals.offered || "—"}</span>
                      </div>
                      <div className="bg-slate-50 px-3 py-2 text-center flex items-center justify-center">
                        <span className="text-sm font-semibold text-sky-600">{roleTotals.onboarded || "—"}</span>
                      </div>
                      <div className="bg-slate-50 px-3 py-2 text-center flex items-center justify-center">
                        <span className="text-sm font-semibold text-red-500">{roleTotals.rejected || "—"}</span>
                      </div>
                      <div className="bg-slate-50 px-3 py-2 text-center flex items-center justify-center">
                        {roleTotals.submitted > 0 ? (
                          <span className="text-xs font-semibold text-slate-500">
                            {Math.round((roleTotals.selected / roleTotals.submitted) * 100)}%
                          </span>
                        ) : <span className="text-slate-300">—</span>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Footer totals */}
        {rows.length > 0 && (
          <div className={cn("grid gap-px bg-slate-200 border-t-2 border-slate-200", GRID)}>
            <div className="bg-slate-50 px-4 py-3 flex items-center">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total</span>
            </div>
            <div className="bg-slate-50 px-4 py-3" />
            <div className="bg-slate-50 px-3 py-3 text-center">
              <span className="text-sm font-bold text-slate-700">{summary.submitted}</span>
            </div>
            <div className="bg-slate-50 px-3 py-3 text-center">
              <span className="text-sm font-bold text-blue-700">{summary.interviews}</span>
            </div>
            <div className="bg-slate-50 px-3 py-3 text-center">
              <span className="text-sm font-bold text-green-700">{summary.selected}</span>
            </div>
            <div className="bg-slate-50 px-3 py-3 text-center">
              <span className="text-sm font-bold text-emerald-700">{summary.offered}</span>
            </div>
            <div className="bg-slate-50 px-3 py-3 text-center">
              <span className="text-sm font-bold text-sky-700">{summary.onboarded}</span>
            </div>
            <div className="bg-slate-50 px-3 py-3 text-center">
              <span className="text-sm font-bold text-red-600">{summary.rejected}</span>
            </div>
            <div className="bg-slate-50 px-3 py-3 text-center">
              <span className="text-sm font-bold text-slate-600">
                {summary.submitted > 0 ? `${Math.round((summary.selected / summary.submitted) * 100)}%` : "—"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Mobile cards — hidden on md+ */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="h-4 bg-slate-100 rounded animate-pulse w-1/2" />
                <div className="h-3 bg-slate-100 rounded animate-pulse w-3/4" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 py-12 text-center text-slate-400">
            <BarChart3 size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No data yet.</p>
          </div>
        ) : (
          <>
            {Object.entries(grouped).map(([roleDbId, roleRows]) => {
              const first = roleRows[0];
              const multiRecruiter = roleRows.length > 1;
              const roleTotals = multiRecruiter
                ? roleRows.reduce(
                    (acc, r) => ({
                      submitted:  acc.submitted  + r.submitted,
                      interviews: acc.interviews + r.interviews,
                      selected:   acc.selected   + r.selected,
                      offered:    acc.offered    + r.offered,
                      onboarded:  acc.onboarded  + r.onboarded,
                      rejected:   acc.rejected   + r.rejected,
                    }),
                    { submitted: 0, interviews: 0, selected: 0, offered: 0, onboarded: 0, rejected: 0 }
                  )
                : null;

              return (
                <div key={roleDbId} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  {/* Role header */}
                  <div className="px-4 pt-3 pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <span className="text-xs font-mono text-slate-400">{first.roleId}</span>
                      <span className={cn(
                        "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                        first.roleStatus === "Active"  ? "bg-green-100 text-green-700"   :
                        first.roleStatus === "OnHold"  ? "bg-yellow-100 text-yellow-700" :
                        first.roleStatus === "Closed"  ? "bg-red-100 text-red-700"       :
                        "bg-slate-100 text-slate-500"
                      )}>
                        {first.roleStatus}
                      </span>
                      {PRIORITY_CONFIG[first.rolePriority] && (
                        <span className={cn(
                          "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                          PRIORITY_CONFIG[first.rolePriority].className
                        )}>
                          {PRIORITY_CONFIG[first.rolePriority].label}
                        </span>
                      )}
                    </div>
                    <Link
                      href={`/roles/${first.roleDbId}/kanban`}
                      className="text-sm font-semibold text-slate-900 hover:text-blue-600 leading-tight block"
                    >
                      {first.roleTitle}
                    </Link>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <p className="text-xs text-slate-400">{first.clientName}</p>
                      {first.pocName && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-600">
                          {first.pocName.split(" ")[0]}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Per-recruiter stats */}
                  <div className="divide-y divide-slate-100">
                    {roleRows.map((row) => (
                      <div key={`${roleDbId}-${row.recruiterId}`} className="px-4 py-3">
                        {multiRecruiter && (
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[9px] font-bold flex items-center justify-center shrink-0">
                              {row.recruiterName.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-xs font-semibold text-slate-600">{row.recruiterName}</span>
                          </div>
                        )}
                        <div className="grid grid-cols-3 gap-2">
                          <div className="text-center">
                            <p className="text-xs text-slate-400 mb-0.5">Submitted</p>
                            <p className="text-sm font-semibold text-slate-700">{row.submitted || "—"}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-slate-400 mb-0.5">Interviews</p>
                            <p className="text-sm font-semibold text-blue-600">{row.interviews || "—"}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-slate-400 mb-0.5">Selected</p>
                            <p className="text-sm font-semibold text-green-600">{row.selected || "—"}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-slate-400 mb-0.5">Offered</p>
                            <p className="text-sm font-semibold text-emerald-600">{row.offered || "—"}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-slate-400 mb-0.5">Onboarded</p>
                            <p className="text-sm font-semibold text-sky-600">{row.onboarded || "—"}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-slate-400 mb-0.5">Rejected</p>
                            <p className="text-sm font-semibold text-red-500">{row.rejected || "—"}</p>
                          </div>
                          <div className="col-span-3 text-center mt-1">
                            <p className="text-xs text-slate-400 mb-0.5">Conversion</p>
                            <p className="text-sm font-semibold text-slate-600">
                              {row.submitted > 0 ? `${Math.round((row.selected / row.submitted) * 100)}%` : "—"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Multi-recruiter total */}
                    {multiRecruiter && roleTotals && (
                      <div className="px-4 py-3 bg-slate-50">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
                          {first.roleId} total · {roleRows.length} owners
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="text-center">
                            <p className="text-xs text-slate-400 mb-0.5">Submitted</p>
                            <p className="text-sm font-bold text-slate-700">{roleTotals.submitted || "—"}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-slate-400 mb-0.5">Interviews</p>
                            <p className="text-sm font-bold text-blue-600">{roleTotals.interviews || "—"}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-slate-400 mb-0.5">Selected</p>
                            <p className="text-sm font-bold text-green-600">{roleTotals.selected || "—"}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-slate-400 mb-0.5">Offered</p>
                            <p className="text-sm font-bold text-emerald-600">{roleTotals.offered || "—"}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-slate-400 mb-0.5">Onboarded</p>
                            <p className="text-sm font-bold text-sky-600">{roleTotals.onboarded || "—"}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-slate-400 mb-0.5">Rejected</p>
                            <p className="text-sm font-bold text-red-500">{roleTotals.rejected || "—"}</p>
                          </div>
                          <div className="col-span-3 text-center mt-1">
                            <p className="text-xs text-slate-400 mb-0.5">Conversion</p>
                            <p className="text-sm font-bold text-slate-600">
                              {roleTotals.submitted > 0 ? `${Math.round((roleTotals.selected / roleTotals.submitted) * 100)}%` : "—"}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Overall summary card */}
            {rows.length > 0 && (
              <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Overall Total</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center">
                    <p className="text-xs text-slate-400 mb-0.5">Submitted</p>
                    <p className="text-sm font-bold text-slate-700">{summary.submitted}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-400 mb-0.5">Interviews</p>
                    <p className="text-sm font-bold text-blue-700">{summary.interviews}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-400 mb-0.5">Selected</p>
                    <p className="text-sm font-bold text-green-700">{summary.selected}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-400 mb-0.5">Offered</p>
                    <p className="text-sm font-bold text-emerald-700">{summary.offered}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-400 mb-0.5">Onboarded</p>
                    <p className="text-sm font-bold text-sky-700">{summary.onboarded}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-400 mb-0.5">Rejected</p>
                    <p className="text-sm font-bold text-red-600">{summary.rejected}</p>
                  </div>
                  <div className="col-span-3 text-center mt-1">
                    <p className="text-xs text-slate-400 mb-0.5">Conversion</p>
                    <p className="text-sm font-bold text-slate-600">
                      {summary.submitted > 0 ? `${Math.round((summary.selected / summary.submitted) * 100)}%` : "—"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Legend */}
      <p className="text-xs text-slate-400">
        <strong>Interviews</strong> = candidates currently at R1, R2 or Client Round stage. &nbsp;
        <strong>Conversion</strong> = Selected ÷ Submitted. &nbsp;
        Percentages shown in brackets are relative to Submitted count.
      </p>
    </div>
  );
}
