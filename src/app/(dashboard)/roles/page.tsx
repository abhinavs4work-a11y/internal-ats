"use client";

import { useState, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RoleStatusBadge } from "@/components/shared/StatusBadge";
import type { RoleWithClient, ClientWithRoleCount, User } from "@/types";
import { RolePriority, RoleStatus } from "@prisma/client";
import {
  Plus, Search, Pencil, Trash2, Briefcase, ChevronRight,
  CheckSquare, X, CalendarDays, User as UserIcon, Mail, UserCircle,
} from "lucide-react";
import { formatDate, formatCurrency, toIndianFormat, fromIndianFormat } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";

type ClientPoc = { name: string; email: string };

type RoleForm = {
  title: string;
  clientId: string;
  budget: string;
  openings: string;
  locations: string;
  jd: string;
  priority: RolePriority;
  status: RoleStatus;
  recruiterIds: string[];
  poc: ClientPoc | null;
};

const emptyForm: RoleForm = {
  title: "",
  clientId: "",
  budget: "",
  openings: "1",
  locations: "",
  jd: "",
  priority: "Medium",
  status: "Active",
  recruiterIds: [],
  poc: null,
};

const todayISO = new Date().toISOString().split("T")[0];

// ─── Indian number input ──────────────────────────────────────────────────────
function IndianNumberInput({ value, onChange, placeholder, className }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  return (
    <Input
      inputMode="numeric"
      value={value}
      placeholder={placeholder}
      className={className}
      onChange={(e) => {
        const raw = e.target.value.replace(/,/g, "").replace(/[^0-9]/g, "");
        onChange(raw ? toIndianFormat(raw) : "");
      }}
    />
  );
}

// ─── Inline POC selector ──────────────────────────────────────────────────────
function PocSelector({
  clientId,
  clients,
  selected,
  onSelect,
  onPocAdded,
}: {
  clientId: string;
  clients: ClientWithRoleCount[];
  selected: ClientPoc | null;
  onSelect: (poc: ClientPoc | null) => void;
  onPocAdded: () => void; // caller should invalidate ["clients"]
}) {
  const [addingNew, setAddingNew] = useState(false);
  const [newName,   setNewName]   = useState("");
  const [newEmail,  setNewEmail]  = useState("");
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const client = clients.find((c) => c.id === clientId);
  const pocs   = (client?.pocs as unknown as ClientPoc[]) ?? [];

  async function addAndSelect() {
    if (!newName.trim()) { setError("Name is required"); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "addPoc", poc: { name: newName.trim(), email: newEmail.trim() } }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Failed to add POC"); }
      const created: ClientPoc = { name: newName.trim(), email: newEmail.trim() };
      onPocAdded();           // invalidate clients query so the list refreshes
      onSelect(created);      // auto-select the new POC
      setAddingNew(false); setNewName(""); setNewEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2.5">
      {/* Existing POCs as pill buttons */}
      {pocs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pocs.map((poc, i) => {
            const isSelected = selected?.name === poc.name && selected?.email === poc.email;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onSelect(isSelected ? null : poc)}
                className={cn(
                  "flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border transition-colors",
                  isSelected
                    ? "bg-blue-600 text-white border-blue-600"
                    : "border-slate-200 text-slate-700 hover:border-blue-400 hover:bg-blue-50"
                )}
              >
                <UserCircle size={12} className={isSelected ? "text-blue-200" : "text-slate-400"} />
                <span className="font-medium">{poc.name}</span>
                {poc.email && (
                  <span className={cn("text-xs", isSelected ? "text-blue-200" : "text-slate-400")}>
                    · {poc.email}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {pocs.length === 0 && !addingNew && (
        <p className="text-xs text-slate-400">No POCs added for this client yet.</p>
      )}

      {/* "Add new POC" trigger or inline form */}
      {!addingNew ? (
        <button
          type="button"
          onClick={() => setAddingNew(true)}
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          <Plus size={12} />
          Add new POC{pocs.length > 0 ? " to this client" : ""}
        </button>
      ) : (
        <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 space-y-2.5">
          <p className="text-xs font-semibold text-slate-700">
            New POC — will be saved to <span className="text-blue-700">{client?.name}</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <UserIcon size={11} /> Name *
              </div>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Santhosh Kumar"
                className="h-8 text-xs"
                disabled={saving}
                onKeyDown={(e) => e.key === "Enter" && addAndSelect()}
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <Mail size={11} /> Email
              </div>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="santhosh@client.com"
                className="h-8 text-xs"
                disabled={saving}
                onKeyDown={(e) => e.key === "Enter" && addAndSelect()}
              />
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button
              size="sm" className="h-7 text-xs"
              disabled={!newName.trim() || saving}
              onClick={addAndSelect}
            >
              {saving ? "Adding…" : "Add & Select"}
            </Button>
            <Button
              size="sm" variant="ghost" className="h-7 text-xs"
              onClick={() => { setAddingNew(false); setNewName(""); setNewEmail(""); setError(null); }}
              disabled={saving}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function RolesPage() {
  return (
    <Suspense>
      <RolesContent />
    </Suspense>
  );
}

function RolesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search,          setSearch]          = useState("");
  const [statusFilter,    setStatusFilter]    = useState<string>(searchParams.get("status") ?? "");
  const [clientFilter,    setClientFilter]    = useState<string>("");
  const [priorityFilter,  setPriorityFilter]  = useState<string>("");
  const [recruiterFilter, setRecruiterFilter] = useState<string>("");
  const [sheetOpen,       setSheetOpen]       = useState(false);
  const [editingRole,  setEditingRole]  = useState<RoleWithClient | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RoleWithClient | null>(null);
  const [form,         setForm]         = useState<RoleForm>(emptyForm);

  // Bulk selection
  const [selectedIds,     setSelectedIds]     = useState<Set<string>>(new Set());
  const [bulkDeleteOpen,  setBulkDeleteOpen]  = useState(false);
  const [bulkDateOpen,    setBulkDateOpen]    = useState(false);
  const [bulkDate,        setBulkDate]        = useState(todayISO);

  const queryClient = useQueryClient();

  const { data: roles = [], isLoading } = useQuery<RoleWithClient[]>({
    queryKey: ["roles", search, statusFilter, clientFilter, priorityFilter, recruiterFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search)           params.set("search",      search);
      if (statusFilter)     params.set("status",      statusFilter);
      if (clientFilter)     params.set("clientId",    clientFilter);
      if (priorityFilter)   params.set("priority",    priorityFilter);
      if (recruiterFilter)  params.set("recruiterId", recruiterFilter);
      const res = await fetch(`/api/roles?${params}`);
      return res.json();
    },
  });

  const { data: clients = [] } = useQuery<ClientWithRoleCount[]>({
    queryKey: ["clients"],
    queryFn: async () => { const res = await fetch("/api/clients"); return res.json(); },
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: async () => { const res = await fetch("/api/users"); return res.json(); },
  });

  // ── Save role ───────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async (data: RoleForm) => {
      const payload = {
        ...data,
        budget: data.budget ? fromIndianFormat(data.budget) : null,
        openings: parseInt(data.openings) || 1,
        locations: data.locations.split(",").map((s) => s.trim()).filter(Boolean),
        poc: data.poc ?? null,
      };
      const url    = editingRole ? `/api/roles/${editingRole.id}` : "/api/roles";
      const method = editingRole ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? "Failed to save role"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      setSheetOpen(false); setForm(emptyForm); setEditingRole(null);
    },
  });

  // ── Single delete ───────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/roles/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["roles"] }); setDeleteTarget(null); },
  });

  // ── Bulk delete ─────────────────────────────────────────────────────────────
  const bulkDeleteMutation = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selectedIds);
      await Promise.allSettled(ids.map((id) => fetch(`/api/roles/${id}`, { method: "DELETE" })));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      setSelectedIds(new Set()); setBulkDeleteOpen(false);
    },
  });

  // ── Bulk change created date ────────────────────────────────────────────────
  const bulkDateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/roles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleIds: Array.from(selectedIds), action: "updateCreatedDate", date: bulkDate }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Failed to update"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      setSelectedIds(new Set()); setBulkDateOpen(false); setBulkDate(todayISO);
    },
  });

  // ── Selection helpers ───────────────────────────────────────────────────────
  const allSelected  = roles.length > 0 && roles.every((r) => selectedIds.has(r.id));
  const someSelected = selectedIds.size > 0 && !allSelected;

  function toggleAll() {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(roles.map((r) => r.id)));
  }
  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next;
    });
  }

  function openCreate() { setEditingRole(null); setForm(emptyForm); setSheetOpen(true); }

  function openEdit(role: RoleWithClient) {
    setEditingRole(role);
    setForm({
      title: role.title,
      clientId: role.clientId,
      budget: role.budget ? toIndianFormat(Math.round(Number(role.budget)).toString()) : "",
      openings: role.openings.toString(),
      locations: role.locations.join(", "),
      jd: role.jd ?? "",
      priority: role.priority as RolePriority,
      status: role.status as RoleStatus,
      recruiterIds: role.recruiters.map((r) => r.recruiter.id),
      poc: (role as any).poc as ClientPoc | null ?? null,
    });
    setSheetOpen(true);
  }

  const priorityColor: Record<string, string> = {
    High: "text-red-600 bg-red-50",
    Medium: "text-yellow-700 bg-yellow-50",
    Low: "text-slate-600 bg-slate-100",
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Roles</h1>
          <p className="text-slate-500 text-sm mt-1">{roles.length} role{roles.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={openCreate} size="sm"><Plus size={16} /> Add Role</Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search roles..." className="pl-9 w-56" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={clientFilter || "all"} onValueChange={(v) => setClientFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All clients" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priorityFilter || "all"} onValueChange={(v) => setPriorityFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All priorities" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="High">High</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="Low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="OnHold">On Hold</SelectItem>
            <SelectItem value="Inactive">Inactive</SelectItem>
            <SelectItem value="Closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={recruiterFilter || "all"} onValueChange={(v) => setRecruiterFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All owners" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All owners</SelectItem>
            {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-600 text-white rounded-xl shadow-sm">
          <CheckSquare size={16} className="shrink-0" />
          <span className="text-sm font-medium">{selectedIds.size} role{selectedIds.size !== 1 ? "s" : ""} selected</span>
          <div className="flex-1" />
          <Button size="sm" variant="secondary" className="h-7 text-xs bg-white/20 hover:bg-white/30 text-white border-0"
            onClick={() => { setBulkDate(todayISO); setBulkDateOpen(true); }}>
            <CalendarDays size={13} /> Change Created Date
          </Button>
          <Button size="sm" variant="secondary" className="h-7 text-xs bg-white/20 hover:bg-white/30 text-white border-0"
            onClick={() => setBulkDeleteOpen(true)}>
            <Trash2 size={13} /> Delete
          </Button>
          <button className="ml-1 opacity-70 hover:opacity-100" onClick={() => setSelectedIds(new Set())}><X size={16} /></button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input type="checkbox" className="rounded border-slate-300 cursor-pointer"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected; }}
                  onChange={toggleAll} />
              </TableHead>
              <TableHead>Role ID</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>POC</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Candidates</TableHead>
              <TableHead>Openings</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 11 }).map((_, j) => (
                  <TableCell key={j}><div className="h-4 bg-slate-100 rounded animate-pulse" /></TableCell>
                ))}</TableRow>
              ))
            ) : roles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-12 text-slate-400">
                  <Briefcase size={32} className="mx-auto mb-2 opacity-30" />
                  <p>No roles found. Create your first role.</p>
                </TableCell>
              </TableRow>
            ) : (
              roles.map((role) => {
                const isSelected = selectedIds.has(role.id);
                const poc = (role as any).poc as ClientPoc | null;
                return (
                  <TableRow
                    key={role.id}
                    className={cn("cursor-pointer", isSelected ? "bg-blue-50 hover:bg-blue-50" : "hover:bg-slate-50")}
                    onClick={() => router.push(`/roles/${role.id}/kanban`)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" className="rounded border-slate-300 cursor-pointer"
                        checked={isSelected} onChange={() => toggleOne(role.id)} />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">{role.roleId}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 font-medium">
                        {role.title}<ChevronRight size={13} className="text-slate-300" />
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">{role.client.name}</TableCell>
                    <TableCell className="text-sm">
                      {poc ? (
                        <div className="flex items-center gap-1 text-slate-700">
                          <UserCircle size={13} className="text-slate-400 shrink-0" />
                          <span className="font-medium">{poc.name.split(" ")[0]}</span>
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {role.recruiters.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {role.recruiters.map((r) => (
                            <span key={r.recruiter.id} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-violet-50 text-violet-700 border border-violet-100">
                              {r.recruiter.name.split(" ")[0]}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${priorityColor[role.priority]}`}>
                        {role.priority}
                      </span>
                    </TableCell>
                    <TableCell><RoleStatusBadge status={role.status} /></TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {(role as any)._count?.mappings > 0 ? (
                        <span className="font-medium text-slate-700">{(role as any)._count.mappings}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">{role.openings}</TableCell>
                    <TableCell className="text-sm text-slate-500">{formatDate(role.createdDate)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(role)}>
                          <Pencil size={13} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-50" onClick={() => setDeleteTarget(role)}>
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Create/Edit Sheet ── */}
      <Sheet open={sheetOpen} onOpenChange={(o) => { setSheetOpen(o); if (!o) setEditingRole(null); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingRole ? "Edit Role" : "Add Role"}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label>Role Title *</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Senior React Developer" />
            </div>

            <div className="space-y-1.5">
              <Label>Client *</Label>
              <Select
                value={form.clientId}
                onValueChange={(v) => setForm((f) => ({ ...f, clientId: v, poc: null }))}
              >
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            {/* POC — only shown once a client is selected */}
            {form.clientId && (
              <div className="space-y-1.5">
                <Label>Client POC</Label>
                <PocSelector
                  clientId={form.clientId}
                  clients={clients}
                  selected={form.poc}
                  onSelect={(poc) => setForm((f) => ({ ...f, poc }))}
                  onPocAdded={() => queryClient.invalidateQueries({ queryKey: ["clients"] })}
                />
                {form.poc && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                    <span className="text-slate-400">Selected:</span>
                    <span className="font-medium text-slate-700">{form.poc.name}</span>
                    {form.poc.email && <span className="text-slate-400">{form.poc.email}</span>}
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, poc: null }))}
                      className="text-slate-400 hover:text-red-500 ml-auto"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Budget (₹)</Label>
                <IndianNumberInput value={form.budget} onChange={(v) => setForm((f) => ({ ...f, budget: v }))} placeholder="e.g. 20,00,000" />
              </div>
              <div className="space-y-1.5">
                <Label>Openings</Label>
                <Input type="number" min={1} value={form.openings} onChange={(e) => setForm((f) => ({ ...f, openings: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v as RolePriority }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as RoleStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="OnHold">On Hold</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                    <SelectItem value="Closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Locations (comma-separated)</Label>
              <Input value={form.locations} onChange={(e) => setForm((f) => ({ ...f, locations: e.target.value }))} placeholder="Bangalore, Mumbai, Remote" />
            </div>

            <div className="space-y-1.5">
              <Label>Owner</Label>
              <div className="flex flex-wrap gap-2">
                {users.map((u) => (
                  <button key={u.id} type="button"
                    onClick={() => setForm((f) => ({
                      ...f,
                      recruiterIds: f.recruiterIds.includes(u.id)
                        ? f.recruiterIds.filter((id) => id !== u.id)
                        : [...f.recruiterIds, u.id],
                    }))}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      form.recruiterIds.includes(u.id)
                        ? "bg-blue-600 text-white border-blue-600"
                        : "border-slate-200 text-slate-600 hover:border-blue-400"
                    }`}
                  >
                    {u.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Job Description</Label>
              <Textarea value={form.jd} onChange={(e) => setForm((f) => ({ ...f, jd: e.target.value }))} placeholder="Role description, requirements..." rows={5} />
            </div>

            {saveMutation.error && (
              <p className="text-sm text-red-600">{(saveMutation.error as Error).message}</p>
            )}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setSheetOpen(false)}>Cancel</Button>
              <Button className="flex-1" disabled={saveMutation.isPending || !form.title || !form.clientId} onClick={() => saveMutation.mutate(form)}>
                {saveMutation.isPending ? "Saving..." : editingRole ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Bulk Delete Dialog ── */}
      <Dialog open={bulkDeleteOpen} onOpenChange={(o) => !bulkDeleteMutation.isPending && setBulkDeleteOpen(o)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete {selectedIds.size} Role{selectedIds.size !== 1 ? "s" : ""}?</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600">
            This will permanently delete <strong>{selectedIds.size}</strong> role{selectedIds.size !== 1 ? "s" : ""} and all their candidate mappings. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setBulkDeleteOpen(false)} disabled={bulkDeleteMutation.isPending}>Cancel</Button>
            <Button variant="destructive" size="sm" disabled={bulkDeleteMutation.isPending} onClick={() => bulkDeleteMutation.mutate()}>
              {bulkDeleteMutation.isPending ? "Deleting…" : `Delete ${selectedIds.size}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Bulk Change Created Date Dialog ── */}
      <Dialog open={bulkDateOpen} onOpenChange={(o) => { if (!bulkDateMutation.isPending) { setBulkDateOpen(o); if (!o) setBulkDate(todayISO); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Change Created Date</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Set the <strong>Created Date</strong> for <strong>{selectedIds.size} role{selectedIds.size !== 1 ? "s" : ""}</strong> to:
            </p>
            <div className="space-y-1.5">
              <Label>New Created Date</Label>
              <Input type="date" value={bulkDate} max={todayISO}
                onChange={(e) => setBulkDate(e.target.value)} className="block" disabled={bulkDateMutation.isPending} />
            </div>
            {bulkDateMutation.error && (
              <p className="text-xs text-red-600">{(bulkDateMutation.error as Error).message}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setBulkDateOpen(false)} disabled={bulkDateMutation.isPending}>Cancel</Button>
            <Button size="sm" disabled={!bulkDate || bulkDateMutation.isPending} onClick={() => bulkDateMutation.mutate()}>
              {bulkDateMutation.isPending ? "Updating…" : `Apply to ${selectedIds.size}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Single Delete Dialog ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Role</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600">
            Delete <strong>{deleteTarget?.roleId} – {deleteTarget?.title}</strong>? This will remove all candidate mappings for this role.
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" size="sm" disabled={deleteMutation.isPending} onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
