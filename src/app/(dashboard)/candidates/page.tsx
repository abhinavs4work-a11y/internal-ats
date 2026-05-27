"use client";

import { useState, Fragment } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { MappingStatusBadge } from "@/components/shared/StatusBadge";
import { CandidateDetailSheet } from "@/components/candidates/CandidateDetailSheet";
import type { CandidateWithMappings, RoleWithClient, User } from "@/types";
import { CandidateSource } from "@prisma/client";
import { Plus, Search, Pencil, Trash2, Users, Clock, UserPlus, X, CheckSquare, Upload, FileText, Loader2 } from "lucide-react";
import { formatDate, formatCurrency, toIndianFormat, fromIndianFormat } from "@/lib/utils";
import { cn } from "@/lib/utils";

type CandidateForm = {
  fullName: string; email: string; phone: string;
  currentCtc: string; expectedCtc: string;
  offersInHand: boolean; offerAmount: string;
  currentLocation: string; preferredLocations: string;
  source: string; availability: string; notes: string;
  dailyRate: string; ownerId: string;
};

const emptyForm: CandidateForm = {
  fullName: "", email: "", phone: "",
  currentCtc: "", expectedCtc: "",
  offersInHand: false, offerAmount: "",
  currentLocation: "", preferredLocations: "",
  source: "InternalLinkedIn", availability: "", notes: "",
  dailyRate: "", ownerId: "",
};

const todayISO = new Date().toISOString().split("T")[0];

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

const SOURCE_LABELS: Record<CandidateSource, string> = {
  InternalResdex: "Internal (Resdex)",
  InternalLinkedIn: "Internal (LinkedIn)",
  Reference: "Reference",
  Agency: "Agency",
};

export default function CandidatesPage() {
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<CandidateWithMappings | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateWithMappings | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CandidateWithMappings | null>(null);
  const [form, setForm] = useState<CandidateForm>(emptyForm);
  const [duplicateWarning, setDuplicateWarning] = useState<{ id: string; candidateId: string } | null>(null);
  const [addMappingOpen, setAddMappingOpen] = useState(false);
  const [mappingForm, setMappingForm] = useState({ roleId: "", recruiterId: "", submissionDate: todayISO });
  const [pendingResumeFile, setPendingResumeFile] = useState<File | null>(null);
  const [resumeUploading, setResumeUploading] = useState(false);

  // ── Bulk selection ──────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAddOpen, setBulkAddOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkMappingForm, setBulkMappingForm] = useState({ roleId: "", recruiterId: "", submissionDate: todayISO });
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number; errors: string[] } | null>(null);

  const queryClient = useQueryClient();

  const { data: result, isLoading } = useQuery<{ candidates: CandidateWithMappings[]; total: number }>({
    queryKey: ["candidates", search],
    queryFn: async () => {
      const res = await fetch(`/api/candidates?search=${encodeURIComponent(search)}&limit=100`);
      return res.json();
    },
  });

  const candidates = result?.candidates ?? [];

  const { data: roles = [] } = useQuery<RoleWithClient[]>({
    queryKey: ["roles"],
    queryFn: async () => {
      const res = await fetch("/api/roles?status=Active");
      return res.json();
    },
    enabled: addMappingOpen || bulkAddOpen,
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: async () => { const res = await fetch("/api/users"); return res.json(); },
  });

  const { data: currentUser } = useQuery<User>({
    queryKey: ["me"],
    queryFn: async () => { const res = await fetch("/api/me"); return res.json(); },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: CandidateForm) => {
      const url = editingCandidate ? `/api/candidates/${editingCandidate.id}` : "/api/candidates";
      const method = editingCandidate ? "PUT" : "POST";
      const payload = {
        ...data,
        currentCtc: data.currentCtc ? fromIndianFormat(data.currentCtc) : null,
        expectedCtc: data.expectedCtc ? fromIndianFormat(data.expectedCtc) : null,
        offerAmount: data.offerAmount ? fromIndianFormat(data.offerAmount) : null,
        preferredLocations: data.preferredLocations.split(",").map((s) => s.trim()).filter(Boolean),
        dailyRate: data.dailyRate ? parseFloat(data.dailyRate.replace(/,/g, "")) : null,
        ownerId: data.ownerId || null,
      };
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (res.status === 409) { setDuplicateWarning({ id: json.existingId, candidateId: json.existingCandidateId }); throw new Error("duplicate"); }
      if (!res.ok) throw new Error(json.error ?? "Failed to save");
      return json;
    },
    onSuccess: async (savedCandidate) => {
      // Upload resume if one was selected
      if (pendingResumeFile) {
        setResumeUploading(true);
        try {
          const fd = new FormData();
          fd.append("resume", pendingResumeFile);
          await fetch(`/api/candidates/${savedCandidate.id}/resume`, { method: "POST", body: fd });
        } finally {
          setResumeUploading(false);
          setPendingResumeFile(null);
        }
      }
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      setSheetOpen(false); setForm(emptyForm); setEditingCandidate(null); setDuplicateWarning(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/candidates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["candidates"] }); setDeleteTarget(null); },
  });

  // Single "Add to Role" (from duplicate-email warning flow)
  const addMappingMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId: selectedCandidate?.id, roleId: mappingForm.roleId, recruiterId: mappingForm.recruiterId, submissionDate: mappingForm.submissionDate }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      setAddMappingOpen(false);
      setMappingForm({ roleId: "", recruiterId: "", submissionDate: todayISO });
    },
  });

  // Bulk "Add to Role"
  const bulkAddMutation = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selectedIds);
      setBulkProgress({ done: 0, total: ids.length, errors: [] });
      const errors: string[] = [];
      for (let i = 0; i < ids.length; i++) {
        const res = await fetch("/api/mappings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ candidateId: ids[i], roleId: bulkMappingForm.roleId, recruiterId: bulkMappingForm.recruiterId, submissionDate: bulkMappingForm.submissionDate }),
        });
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          const cand = candidates.find((c) => c.id === ids[i]);
          errors.push(`${cand?.fullName ?? ids[i]}: ${e.error ?? "failed"}`);
        }
        setBulkProgress({ done: i + 1, total: ids.length, errors });
      }
      return errors;
    },
    onSuccess: (errors) => {
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      if (errors.length === 0) {
        setBulkAddOpen(false);
        setSelectedIds(new Set());
        setBulkMappingForm({ roleId: "", recruiterId: "", submissionDate: todayISO });
        setBulkProgress(null);
      }
      // If there were errors, leave dialog open showing the summary
    },
  });

  // Bulk delete
  const bulkDeleteMutation = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selectedIds);
      await Promise.allSettled(ids.map((id) => fetch(`/api/candidates/${id}`, { method: "DELETE" })));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
    },
  });

  // ── Selection helpers ───────────────────────────────────────────────────────
  const allSelected = candidates.length > 0 && candidates.every((c) => selectedIds.has(c.id));
  const someSelected = selectedIds.size > 0 && !allSelected;

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(candidates.map((c) => c.id)));
    }
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function openCreate() {
    setEditingCandidate(null);
    setForm({ ...emptyForm, ownerId: currentUser?.id ?? "" });
    setDuplicateWarning(null);
    setPendingResumeFile(null);
    setSheetOpen(true);
  }

  function openEdit(c: CandidateWithMappings) {
    setEditingCandidate(c);
    setPendingResumeFile(null);
    setForm({
      fullName: c.fullName, email: c.email, phone: c.phone ?? "",
      currentCtc: c.currentCtc ? toIndianFormat(Math.round(Number(c.currentCtc)).toString()) : "",
      expectedCtc: c.expectedCtc ? toIndianFormat(Math.round(Number(c.expectedCtc)).toString()) : "",
      offersInHand: c.offersInHand,
      offerAmount: c.offerAmount ? toIndianFormat(Math.round(Number(c.offerAmount)).toString()) : "",
      currentLocation: c.currentLocation ?? "",
      preferredLocations: c.preferredLocations.join(", "),
      source: c.source,
      availability: (c as any).availability ?? "",
      notes: c.notes ?? "",
      dailyRate: (c as any).dailyRate ? toIndianFormat(Math.round(Number((c as any).dailyRate)).toString()) : "",
      ownerId: c.owner?.id ?? "",
    });
    setSheetOpen(true);
  }

  function openDetail(c: CandidateWithMappings) {
    setSelectedCandidate(c);
    setDetailOpen(true);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Candidates</h1>
          <p className="text-slate-500 text-sm mt-1">{result?.total ?? 0} total</p>
        </div>
        <Button onClick={openCreate} size="sm"><Plus size={16} /> Add Candidate</Button>
      </div>

      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input placeholder="Search name, email, phone..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* ── Bulk action bar ── */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-600 text-white rounded-xl shadow-sm">
          <CheckSquare size={16} className="shrink-0" />
          <span className="text-sm font-medium">{selectedIds.size} candidate{selectedIds.size !== 1 ? "s" : ""} selected</span>
          <div className="flex-1" />
          <Button
            size="sm"
            variant="secondary"
            className="h-7 text-xs bg-white/20 hover:bg-white/30 text-white border-0"
            onClick={() => { setBulkProgress(null); setBulkAddOpen(true); }}
          >
            <UserPlus size={13} /> Add to Role
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="h-7 text-xs bg-white/20 hover:bg-white/30 text-white border-0"
            onClick={() => setBulkDeleteOpen(true)}
          >
            <Trash2 size={13} /> Delete
          </Button>
          <button className="ml-1 opacity-70 hover:opacity-100" onClick={() => setSelectedIds(new Set())}>
            <X size={16} />
          </button>
        </div>
      )}

      <div className="hidden md:block bg-white rounded-xl border border-slate-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 cursor-pointer"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected; }}
                  onChange={toggleAll}
                />
              </TableHead>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Expected CTC</TableHead>
              <TableHead>Rate/Day</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 9 }).map((_, j) => (
                  <TableCell key={j}><div className="h-4 bg-slate-100 rounded animate-pulse" /></TableCell>
                ))}</TableRow>
              ))
            ) : candidates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-12 text-slate-400">
                  <Users size={32} className="mx-auto mb-2 opacity-30" />
                  <p>No candidates found. Add your first candidate.</p>
                </TableCell>
              </TableRow>
            ) : (
              candidates.map((c) => {
                const isSelected = selectedIds.has(c.id);
                return (
                  <TableRow
                    key={c.id}
                    className={cn("cursor-pointer", isSelected ? "bg-blue-50 hover:bg-blue-50" : "hover:bg-slate-50")}
                    onClick={() => openDetail(c)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 cursor-pointer"
                        checked={isSelected}
                        onChange={() => toggleOne(c.id)}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-400 whitespace-nowrap">{c.candidateId}</TableCell>
                    <TableCell className="font-medium whitespace-nowrap">{c.fullName}</TableCell>
                    <TableCell className="text-sm text-slate-500">{c.email}</TableCell>
                    <TableCell className="text-sm text-blue-700 font-medium whitespace-nowrap">{formatCurrency(Number(c.expectedCtc) || null)}</TableCell>
                    <TableCell className="text-sm text-emerald-700 font-medium whitespace-nowrap">{formatCurrency(Number((c as any).dailyRate) || null)}</TableCell>
                    <TableCell className="text-xs text-slate-500 whitespace-nowrap">{SOURCE_LABELS[c.source as CandidateSource] ?? c.source}</TableCell>
                    <TableCell className="py-2">
                      {c.mappings.length === 0 ? (
                        <span className="text-slate-300 text-sm">—</span>
                      ) : (
                        <div className="flex flex-col divide-y divide-slate-100">
                          {c.mappings.map((m) => (
                            <div key={m.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 items-center py-1.5 first:pt-0 last:pb-0">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-800 truncate leading-tight">
                                  {(m as any).role?.title ?? ""}
                                </p>
                                <p className="text-[10px] font-mono text-slate-400 mt-0.5 truncate">
                                  {(m as any).role?.roleId ?? ""}
                                </p>
                              </div>
                              <div className="shrink-0">
                                <MappingStatusBadge status={m.status} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">{formatDate(c.createdAt)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}><Pencil size={13} /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-50" onClick={() => setDeleteTarget(c)}><Trash2 size={13} /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards — candidates */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse space-y-3">
              <div className="h-4 bg-slate-100 rounded w-1/3" />
              <div className="h-3 bg-slate-100 rounded w-2/3" />
              <div className="h-3 bg-slate-100 rounded w-1/2" />
            </div>
          ))
        ) : candidates.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Users size={32} className="mx-auto mb-2 opacity-30" />
            <p>No candidates found. Add your first candidate.</p>
          </div>
        ) : (
          candidates.map((c) => {
            const isSelected = selectedIds.has(c.id);
            return (
              <div
                key={c.id}
                className={cn(
                  "bg-white rounded-xl border overflow-hidden cursor-pointer active:bg-slate-50",
                  isSelected ? "border-blue-300 bg-blue-50/30" : "border-slate-200"
                )}
                onClick={() => openDetail(c)}
              >
                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
                  <div onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className="rounded border-slate-300 cursor-pointer"
                      checked={isSelected} onChange={() => toggleOne(c.id)} />
                  </div>
                  <span className="font-mono text-xs text-slate-400 shrink-0">{c.candidateId}</span>
                  <span className="font-semibold text-slate-900 truncate flex-1">{c.fullName}</span>
                  <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}><Pencil size={13} /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-50"
                      onClick={() => setDeleteTarget(c)}><Trash2 size={13} /></Button>
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs text-slate-500">Email</span>
                    <span className="text-xs text-slate-600 truncate max-w-[200px]">{c.email}</span>
                  </div>
                  {Number(c.expectedCtc) > 0 && (
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-xs text-slate-500">Expected CTC</span>
                      <span className="text-sm font-medium text-blue-700">{formatCurrency(Number(c.expectedCtc))}</span>
                    </div>
                  )}
                  {Number((c as any).dailyRate) > 0 && (
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-xs text-slate-500">Rate / Day</span>
                      <span className="text-sm font-medium text-emerald-700">{formatCurrency(Number((c as any).dailyRate))}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs text-slate-500">Source</span>
                    <span className="text-xs text-slate-600">{SOURCE_LABELS[c.source as CandidateSource] ?? c.source}</span>
                  </div>
                  {c.mappings.length > 0 && (
                    <div className="px-4 py-2.5 space-y-2">
                      <span className="text-xs text-slate-500 block">Active Roles</span>
                      {c.mappings.map((m) => (
                        <div key={m.id} className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-800 truncate">{(m as any).role?.title ?? ""}</p>
                            <p className="text-[10px] font-mono text-slate-400">{(m as any).role?.roleId ?? ""}</p>
                          </div>
                          <MappingStatusBadge status={m.status} />
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs text-slate-500">Added</span>
                    <span className="text-xs text-slate-500">{formatDate(c.createdAt)}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Create/Edit Sheet ── */}
      <Sheet open={sheetOpen} onOpenChange={(o) => { setSheetOpen(o); if (!o) { setEditingCandidate(null); setDuplicateWarning(null); } }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>{editingCandidate ? "Edit Candidate" : "Add Candidate"}</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Full Name *</Label>
                <Input value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} placeholder="Rahul Sharma" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="rahul@example.com" />
                {duplicateWarning && (
                  <p className="text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded p-2">
                    A candidate with this email already exists ({duplicateWarning.candidateId}).
                    You can <button className="underline font-medium" onClick={() => { setSheetOpen(false); setAddMappingOpen(true); }}>map them to a new role</button> instead.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+91 99999 99999" />
              </div>
              <div className="space-y-1.5">
                <Label>Source</Label>
                <Select value={form.source} onValueChange={(v) => setForm((f) => ({ ...f, source: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SOURCE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Current CTC (₹)</Label>
                <IndianNumberInput value={form.currentCtc} onChange={(v) => setForm((f) => ({ ...f, currentCtc: v }))} placeholder="e.g. 12,00,000" />
              </div>
              <div className="space-y-1.5">
                <Label>Expected CTC (₹)</Label>
                <IndianNumberInput value={form.expectedCtc} onChange={(v) => setForm((f) => ({ ...f, expectedCtc: v }))} placeholder="e.g. 15,00,000" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="offers" checked={form.offersInHand} onChange={(e) => setForm((f) => ({ ...f, offersInHand: e.target.checked }))} className="rounded" />
                  <Label htmlFor="offers">Has offers in hand</Label>
                </div>
                {form.offersInHand && (
                  <IndianNumberInput value={form.offerAmount} onChange={(v) => setForm((f) => ({ ...f, offerAmount: v }))} placeholder="e.g. 18,00,000" />
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Current Location</Label>
                <Input value={form.currentLocation} onChange={(e) => setForm((f) => ({ ...f, currentLocation: e.target.value }))} placeholder="Bangalore" />
              </div>
              <div className="space-y-1.5">
                <Label>Preferred Locations</Label>
                <Input value={form.preferredLocations} onChange={(e) => setForm((f) => ({ ...f, preferredLocations: e.target.value }))} placeholder="Mumbai, Remote" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="flex items-center gap-1.5"><Clock size={13} className="text-slate-400" />Availability</Label>
                <Input value={form.availability} onChange={(e) => setForm((f) => ({ ...f, availability: e.target.value }))} placeholder="e.g. 30 days  or  LWD - 30 May" />
                <p className="text-xs text-slate-400">Notice period or last working day</p>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Daily Rate (₹) <span className="text-slate-400 font-normal text-xs">— override or set manually</span></Label>
                <IndianNumberInput value={form.dailyRate} onChange={(v) => setForm((f) => ({ ...f, dailyRate: v }))} placeholder="e.g. 5,000" />
                <p className="text-xs text-slate-400">Auto-updated from Margin Calculator, or enter manually.</p>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Owner <span className="text-slate-400 font-normal text-xs">— optional</span></Label>
                <Select value={form.ownerId || "none"} onValueChange={(v) => setForm((f) => ({ ...f, ownerId: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Resume / CV</Label>
                {editingCandidate?.resumeUrl && !pendingResumeFile && (
                  <a href={editingCandidate.resumeUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline mb-1">
                    <FileText size={12} />{(editingCandidate as any).resumeFileName ?? "Current resume"}
                  </a>
                )}
                <label className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border border-dashed cursor-pointer transition-colors ${pendingResumeFile ? "border-violet-400 bg-violet-50 text-violet-700" : "border-slate-200 text-slate-500 hover:border-violet-300 hover:text-violet-600"}`}>
                  <Upload size={13} />
                  {pendingResumeFile ? pendingResumeFile.name : editingCandidate?.resumeUrl ? "Replace resume" : "Upload resume (PDF / DOC)"}
                  <input type="file" accept=".pdf,.doc,.docx" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) setPendingResumeFile(f); e.target.value = ""; }} />
                </label>
                {pendingResumeFile && (
                  <button type="button" onClick={() => setPendingResumeFile(null)}
                    className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1">
                    <X size={11} /> Remove
                  </button>
                )}
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Any notes about this candidate..." />
              </div>
            </div>
            {saveMutation.error && (saveMutation.error as Error).message !== "duplicate" && (
              <p className="text-sm text-red-600">{(saveMutation.error as Error).message}</p>
            )}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setSheetOpen(false)}>Cancel</Button>
              <Button className="flex-1" disabled={saveMutation.isPending || resumeUploading || !form.fullName || !form.email} onClick={() => saveMutation.mutate(form)}>
                {resumeUploading ? <><Loader2 size={14} className="animate-spin" /> Uploading…</> : saveMutation.isPending ? "Saving..." : editingCandidate ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Candidate Detail Sheet ── */}
      <CandidateDetailSheet
        candidateId={selectedCandidate?.id ?? null}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />

      {/* ── Single Add to Role (duplicate-email flow) ── */}
      <Dialog open={addMappingOpen} onOpenChange={setAddMappingOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add to Role</DialogTitle>
            <DialogDescription>Map {selectedCandidate?.fullName} to a role</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={mappingForm.roleId} onValueChange={(v) => setMappingForm((f) => ({ ...f, roleId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select active role" /></SelectTrigger>
                <SelectContent>{roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.roleId} – {r.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Owner</Label>
              <Select value={mappingForm.recruiterId} onValueChange={(v) => setMappingForm((f) => ({ ...f, recruiterId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger>
                <SelectContent>{users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Submission Date</Label>
              <Input type="date" value={mappingForm.submissionDate} max={todayISO}
                onChange={(e) => setMappingForm((f) => ({ ...f, submissionDate: e.target.value }))} className="block" />
            </div>
            {addMappingMutation.error && <p className="text-xs text-red-600">{(addMappingMutation.error as Error).message}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddMappingOpen(false)}>Cancel</Button>
            <Button size="sm" disabled={!mappingForm.roleId || !mappingForm.recruiterId || addMappingMutation.isPending} onClick={() => addMappingMutation.mutate()}>
              {addMappingMutation.isPending ? "Adding..." : "Add to Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Bulk Add to Role ── */}
      <Dialog open={bulkAddOpen} onOpenChange={(o) => { if (!bulkAddMutation.isPending) { setBulkAddOpen(o); if (!o) { setBulkProgress(null); setBulkMappingForm({ roleId: "", recruiterId: "", submissionDate: todayISO }); } } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add {selectedIds.size} Candidate{selectedIds.size !== 1 ? "s" : ""} to Role</DialogTitle>
            <DialogDescription>All selected candidates will be mapped to the chosen role.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={bulkMappingForm.roleId} onValueChange={(v) => setBulkMappingForm((f) => ({ ...f, roleId: v }))} disabled={bulkAddMutation.isPending}>
                <SelectTrigger><SelectValue placeholder="Select active role" /></SelectTrigger>
                <SelectContent>{roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.roleId} – {r.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Owner</Label>
              <Select value={bulkMappingForm.recruiterId} onValueChange={(v) => setBulkMappingForm((f) => ({ ...f, recruiterId: v }))} disabled={bulkAddMutation.isPending}>
                <SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger>
                <SelectContent>{users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Submission Date</Label>
              <Input type="date" value={bulkMappingForm.submissionDate} max={todayISO}
                onChange={(e) => setBulkMappingForm((f) => ({ ...f, submissionDate: e.target.value }))}
                className="block" disabled={bulkAddMutation.isPending} />
            </div>

            {/* Progress */}
            {bulkProgress && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>Processing…</span>
                  <span>{bulkProgress.done}/{bulkProgress.total}</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${(bulkProgress.done / bulkProgress.total) * 100}%` }}
                  />
                </div>
                {bulkProgress.errors.length > 0 && (
                  <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded p-2 space-y-0.5">
                    <p className="font-medium">{bulkProgress.errors.length} skipped (already mapped):</p>
                    {bulkProgress.errors.map((e, i) => <p key={i}>{e}</p>)}
                  </div>
                )}
                {bulkProgress.done === bulkProgress.total && bulkProgress.errors.length > 0 && (
                  <p className="text-xs text-slate-500">{bulkProgress.total - bulkProgress.errors.length} added successfully.</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            {bulkProgress && bulkProgress.done === bulkProgress.total && bulkProgress.errors.length > 0 ? (
              <Button size="sm" onClick={() => { setBulkAddOpen(false); setSelectedIds(new Set()); setBulkProgress(null); setBulkMappingForm({ roleId: "", recruiterId: "", submissionDate: todayISO }); }}>Done</Button>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => setBulkAddOpen(false)} disabled={bulkAddMutation.isPending}>Cancel</Button>
                <Button size="sm"
                  disabled={!bulkMappingForm.roleId || !bulkMappingForm.recruiterId || bulkAddMutation.isPending}
                  onClick={() => bulkAddMutation.mutate()}>
                  {bulkAddMutation.isPending ? `Adding… (${bulkProgress?.done ?? 0}/${selectedIds.size})` : `Add ${selectedIds.size} to Role`}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Bulk Delete ── */}
      <Dialog open={bulkDeleteOpen} onOpenChange={(o) => !bulkDeleteMutation.isPending && setBulkDeleteOpen(o)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete {selectedIds.size} Candidate{selectedIds.size !== 1 ? "s" : ""}?</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600">
            This will permanently delete <strong>{selectedIds.size}</strong> candidate{selectedIds.size !== 1 ? "s" : ""} and all their role mappings. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setBulkDeleteOpen(false)} disabled={bulkDeleteMutation.isPending}>Cancel</Button>
            <Button variant="destructive" size="sm" disabled={bulkDeleteMutation.isPending} onClick={() => bulkDeleteMutation.mutate()}>
              {bulkDeleteMutation.isPending ? "Deleting…" : `Delete ${selectedIds.size}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Single Delete ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Candidate</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600">Delete <strong>{deleteTarget?.fullName}</strong>? This will remove all their role mappings.</p>
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
