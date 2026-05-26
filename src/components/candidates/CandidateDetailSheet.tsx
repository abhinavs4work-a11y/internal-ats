"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MappingStatusBadge } from "@/components/shared/StatusBadge";
import { ActivityTimeline } from "@/components/shared/ActivityTimeline";
import type { CandidateWithMappings, RoleWithClient, User } from "@/types";
import { CandidateSource } from "@prisma/client";
import { Pencil, Plus, Upload, FileText, Clock, Loader2, X } from "lucide-react";
import { formatDate, formatCurrency, toIndianFormat, fromIndianFormat } from "@/lib/utils";

const todayISO = new Date().toISOString().split("T")[0];

const SOURCE_LABELS: Record<CandidateSource, string> = {
  InternalResdex: "Internal (Resdex)",
  InternalLinkedIn: "Internal (LinkedIn)",
  Reference: "Reference",
  Agency: "Agency",
};

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

interface Props {
  candidateId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CandidateDetailSheet({ candidateId, open, onOpenChange }: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [addMappingOpen, setAddMappingOpen] = useState(false);
  const [form, setForm] = useState<CandidateForm>(emptyForm);
  const [pendingResumeFile, setPendingResumeFile] = useState<File | null>(null);
  const [resumeEditUploading, setResumeEditUploading] = useState(false);
  const [mappingForm, setMappingForm] = useState({ roleId: "", recruiterId: "", submissionDate: todayISO });

  const queryClient = useQueryClient();

  const { data: candidate, isLoading } = useQuery<CandidateWithMappings>({
    queryKey: ["candidate", candidateId],
    queryFn: async () => {
      const res = await fetch(`/api/candidates/${candidateId}`);
      return res.json();
    },
    enabled: !!candidateId && open,
  });

  const { data: roles = [] } = useQuery<RoleWithClient[]>({
    queryKey: ["roles"],
    queryFn: async () => {
      const res = await fetch("/api/roles?status=Active");
      return res.json();
    },
    enabled: addMappingOpen,
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: async () => { const res = await fetch("/api/users"); return res.json(); },
    enabled: addMappingOpen || editOpen,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: CandidateForm) => {
      const payload = {
        ...data,
        currentCtc: data.currentCtc ? fromIndianFormat(data.currentCtc) : null,
        expectedCtc: data.expectedCtc ? fromIndianFormat(data.expectedCtc) : null,
        offerAmount: data.offerAmount ? fromIndianFormat(data.offerAmount) : null,
        preferredLocations: data.preferredLocations.split(",").map((s) => s.trim()).filter(Boolean),
        dailyRate: data.dailyRate ? parseFloat(data.dailyRate.replace(/,/g, "")) : null,
        ownerId: data.ownerId || null,
      };
      const res = await fetch(`/api/candidates/${candidateId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save");
      return json;
    },
    onSuccess: async () => {
      if (pendingResumeFile) {
        setResumeEditUploading(true);
        try {
          const fd = new FormData();
          fd.append("resume", pendingResumeFile);
          await fetch(`/api/candidates/${candidateId}/resume`, { method: "POST", body: fd });
        } finally {
          setResumeEditUploading(false);
          setPendingResumeFile(null);
        }
      }
      queryClient.invalidateQueries({ queryKey: ["candidate", candidateId] });
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      queryClient.invalidateQueries({ queryKey: ["kanban"] });
      setEditOpen(false);
    },
  });

  const addMappingMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId,
          roleId: mappingForm.roleId,
          recruiterId: mappingForm.recruiterId,
          submissionDate: mappingForm.submissionDate,
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidate", candidateId] });
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      queryClient.invalidateQueries({ queryKey: ["kanban"] });
      setAddMappingOpen(false);
      setMappingForm({ roleId: "", recruiterId: "", submissionDate: todayISO });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("resume", file);
      const res = await fetch(`/api/candidates/${candidateId}/resume`, { method: "POST", body: formData });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidate", candidateId] });
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
    },
  });

  function openEdit() {
    if (!candidate) return;
    setPendingResumeFile(null);
    setForm({
      fullName: candidate.fullName,
      email: candidate.email,
      phone: candidate.phone ?? "",
      currentCtc: candidate.currentCtc ? toIndianFormat(Math.round(Number(candidate.currentCtc)).toString()) : "",
      expectedCtc: candidate.expectedCtc ? toIndianFormat(Math.round(Number(candidate.expectedCtc)).toString()) : "",
      offersInHand: candidate.offersInHand,
      offerAmount: candidate.offerAmount ? toIndianFormat(Math.round(Number(candidate.offerAmount)).toString()) : "",
      currentLocation: candidate.currentLocation ?? "",
      preferredLocations: candidate.preferredLocations.join(", "),
      source: candidate.source,
      availability: (candidate as any).availability ?? "",
      notes: candidate.notes ?? "",
      dailyRate: (candidate as any).dailyRate
        ? toIndianFormat(Math.round(Number((candidate as any).dailyRate)).toString())
        : "",
      ownerId: (candidate as any).owner?.id ?? "",
    });
    setEditOpen(true);
  }

  return (
    <>
      {/* ── Detail Sheet ── */}
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {isLoading || !candidate ? (
            <>
              <SheetHeader>
                <SheetTitle className="sr-only">Loading candidate…</SheetTitle>
              </SheetHeader>
              <div className="flex items-center justify-center h-full">
                <Loader2 className="animate-spin text-slate-400" size={24} />
              </div>
            </>
          ) : (
            <>
              <SheetHeader>
                <div className="flex items-center justify-between pr-6">
                  <div>
                    <SheetTitle>{candidate.fullName}</SheetTitle>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">{candidate.candidateId}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={openEdit}>
                      <Pencil size={13} /> Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setAddMappingOpen(true)}>
                      <Plus size={13} /> Add to Role
                    </Button>
                  </div>
                </div>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Basic info */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-slate-400 text-xs">Email</p><p className="font-medium">{candidate.email}</p></div>
                  <div><p className="text-slate-400 text-xs">Phone</p><p>{candidate.phone ?? "—"}</p></div>
                  <div>
                    <p className="text-slate-400 text-xs">Owner</p>
                    <p className="font-medium">{(candidate as any).owner?.name ?? <span className="text-slate-300">—</span>}</p>
                  </div>
                  <div><p className="text-slate-400 text-xs">Current CTC</p><p>{formatCurrency(Number(candidate.currentCtc) || null)}</p></div>
                  <div><p className="text-slate-400 text-xs">Expected CTC</p><p className="text-blue-700 font-semibold">{formatCurrency(Number(candidate.expectedCtc) || null)}</p></div>
                  <div>
                    <p className="text-slate-400 text-xs">Daily Rate</p>
                    <p className="text-emerald-700 font-semibold">
                      {(candidate as any).dailyRate
                        ? formatCurrency(Number((candidate as any).dailyRate))
                        : "—"}
                    </p>
                  </div>
                  <div><p className="text-slate-400 text-xs">Location</p><p>{candidate.currentLocation ?? "—"}</p></div>
                  <div><p className="text-slate-400 text-xs">Source</p><p>{SOURCE_LABELS[candidate.source as CandidateSource] ?? candidate.source}</p></div>
                  <div className="col-span-2">
                    <p className="text-slate-400 text-xs flex items-center gap-1"><Clock size={11} /> Availability</p>
                    <p className="font-medium">{(candidate as any).availability ?? "—"}</p>
                  </div>
                  {candidate.notes && (
                    <div className="col-span-2">
                      <p className="text-slate-400 text-xs">Notes</p>
                      <p className="text-sm text-slate-600 whitespace-pre-wrap">{candidate.notes}</p>
                    </div>
                  )}
                </div>

                {/* Resume */}
                <div>
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Resume</p>
                  {candidate.resumeUrl ? (
                    <a href={candidate.resumeUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                      <FileText size={14} />{candidate.resumeFileName ?? "View Resume"}
                    </a>
                  ) : (
                    <p className="text-sm text-slate-400 mb-1">No resume uploaded</p>
                  )}
                  <label className={`mt-2 flex items-center gap-2 text-xs cursor-pointer transition-colors ${resumeMutation.isPending ? "text-slate-300 pointer-events-none" : "text-slate-500 hover:text-blue-600"}`}>
                    {resumeMutation.isPending ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Upload size={13} />
                    )}
                    {resumeMutation.isPending ? "Uploading…" : candidate.resumeUrl ? "Replace Resume" : "Upload Resume"}
                    <input type="file" accept=".pdf,.doc,.docx" className="hidden" disabled={resumeMutation.isPending}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) resumeMutation.mutate(f); e.target.value = ""; }} />
                  </label>
                  {resumeMutation.isError && (
                    <p className="mt-1 text-xs text-red-600">{(resumeMutation.error as Error).message}</p>
                  )}
                  {resumeMutation.isSuccess && (
                    <p className="mt-1 text-xs text-green-600">Resume uploaded successfully.</p>
                  )}
                </div>

                {/* Role Pipeline */}
                <div>
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">Role Pipeline</p>
                  {candidate.mappings.length === 0 ? (
                    <p className="text-sm text-slate-400">Not mapped to any role yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {candidate.mappings.map((m) => (
                        <div key={m.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                          <div>
                            <p className="text-sm font-medium">{m.role.title}</p>
                            <p className="text-xs text-slate-400">{m.role.roleId} · {m.role.client.name}</p>
                            <p className="text-xs text-slate-400">{formatDate(m.submissionDate)}</p>
                          </div>
                          <MappingStatusBadge status={m.status} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Activity Timeline */}
                <div>
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">Activity</p>
                  <ActivityTimeline entityType="Candidate" entityId={candidate.id} />
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Edit Sheet ── */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>Edit Candidate</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Full Name *</Label>
                <Input value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
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
                <IndianNumberInput value={form.currentCtc} onChange={(v) => setForm((f) => ({ ...f, currentCtc: v }))} placeholder="12,00,000" />
              </div>
              <div className="space-y-1.5">
                <Label>Expected CTC (₹)</Label>
                <IndianNumberInput value={form.expectedCtc} onChange={(v) => setForm((f) => ({ ...f, expectedCtc: v }))} placeholder="15,00,000" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="edit-offers" checked={form.offersInHand}
                    onChange={(e) => setForm((f) => ({ ...f, offersInHand: e.target.checked }))} className="rounded" />
                  <Label htmlFor="edit-offers">Has offers in hand</Label>
                </div>
                {form.offersInHand && (
                  <IndianNumberInput value={form.offerAmount} onChange={(v) => setForm((f) => ({ ...f, offerAmount: v }))} placeholder="18,00,000" />
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
                {candidate?.resumeUrl && !pendingResumeFile && (
                  <a href={candidate.resumeUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline mb-1">
                    <FileText size={12} />{candidate.resumeFileName ?? "Current resume"}
                  </a>
                )}
                <label className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border border-dashed cursor-pointer transition-colors ${pendingResumeFile ? "border-violet-400 bg-violet-50 text-violet-700" : "border-slate-200 text-slate-500 hover:border-violet-300 hover:text-violet-600"}`}>
                  <Upload size={13} />
                  {pendingResumeFile ? pendingResumeFile.name : candidate?.resumeUrl ? "Replace resume" : "Upload resume (PDF / DOC)"}
                  <input type="file" accept=".pdf,.doc,.docx" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) setPendingResumeFile(f); e.target.value = ""; }} />
                </label>
                {pendingResumeFile && (
                  <button type="button" onClick={() => setPendingResumeFile(null)}
                    className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1 mt-0.5">
                    <X size={11} /> Remove
                  </button>
                )}
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} />
              </div>
            </div>
            {saveMutation.error && (
              <p className="text-sm text-red-600">{(saveMutation.error as Error).message}</p>
            )}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button className="flex-1" disabled={saveMutation.isPending || resumeEditUploading || !form.fullName || !form.email}
                onClick={() => saveMutation.mutate(form)}>
                {resumeEditUploading ? <><Loader2 size={14} className="animate-spin" /> Uploading…</> : saveMutation.isPending ? "Saving..." : "Update"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Add to Role Dialog ── */}
      <Dialog open={addMappingOpen} onOpenChange={setAddMappingOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add to Role</DialogTitle>
            <DialogDescription>Map {candidate?.fullName} to a role</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={mappingForm.roleId} onValueChange={(v) => setMappingForm((f) => ({ ...f, roleId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select active role" /></SelectTrigger>
                <SelectContent>
                  {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.roleId} – {r.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Recruiter</Label>
              <Select value={mappingForm.recruiterId} onValueChange={(v) => setMappingForm((f) => ({ ...f, recruiterId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select recruiter" /></SelectTrigger>
                <SelectContent>
                  {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Submission Date</Label>
              <Input type="date" value={mappingForm.submissionDate} max={todayISO}
                onChange={(e) => setMappingForm((f) => ({ ...f, submissionDate: e.target.value }))} className="block" />
            </div>
            {addMappingMutation.error && (
              <p className="text-xs text-red-600">{(addMappingMutation.error as Error).message}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddMappingOpen(false)}>Cancel</Button>
            <Button size="sm"
              disabled={!mappingForm.roleId || !mappingForm.recruiterId || addMappingMutation.isPending}
              onClick={() => addMappingMutation.mutate()}>
              {addMappingMutation.isPending ? "Adding..." : "Add to Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
