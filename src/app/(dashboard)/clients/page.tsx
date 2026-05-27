"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RoleStatusBadge } from "@/components/shared/StatusBadge";
import type { ClientWithRoles } from "@/types";
import { RoleStatus } from "@prisma/client";
import { Plus, Search, Pencil, Trash2, Building2, X, Mail, User, ChevronRight } from "lucide-react";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

type ClientPoc = { name: string; email: string };

type ClientForm = {
  name: string;
  pocs: ClientPoc[];
  notes: string;
};

const emptyPoc: ClientPoc = { name: "", email: "" };
const emptyForm: ClientForm = { name: "", pocs: [{ ...emptyPoc }], notes: "" };

export default function ClientsPage() {
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientWithRoles | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClientWithRoles | null>(null);
  const [selectedClient, setSelectedClient] = useState<ClientWithRoles | null>(null);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [form, setForm] = useState<ClientForm>(emptyForm);

  const queryClient = useQueryClient();

  const { data: clients = [], isLoading } = useQuery<ClientWithRoles[]>({
    queryKey: ["clients", search],
    queryFn: async () => {
      const res = await fetch(`/api/clients?search=${encodeURIComponent(search)}`);
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: ClientForm) => {
      const url = editingClient ? `/api/clients/${editingClient.id}` : "/api/clients";
      const method = editingClient ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          pocs: data.pocs.filter((p) => p.name.trim()),
          notes: data.notes,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error ?? "Failed to save client");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setSheetOpen(false);
      setForm(emptyForm);
      setEditingClient(null);
    },
    onError: (err) => {
      console.error("Save client error:", err);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setDeleteTarget(null);
    },
  });

  function openCreate() {
    setEditingClient(null);
    setForm(emptyForm);
    setSheetOpen(true);
  }

  function openEdit(e: React.MouseEvent, client: ClientWithRoles) {
    e.stopPropagation();
    setEditingClient(client);
    const rawPocs = client.pocs as unknown as ClientPoc[];
    setForm({
      name: client.name,
      pocs: rawPocs.length ? rawPocs : [{ ...emptyPoc }],
      notes: client.notes ?? "",
    });
    setSheetOpen(true);
  }

  function openRoles(client: ClientWithRoles) {
    setSelectedClient(client);
    setRolesOpen(true);
  }

  function addPoc() {
    setForm((f) => ({ ...f, pocs: [...f.pocs, { ...emptyPoc }] }));
  }

  function removePoc(idx: number) {
    setForm((f) => ({ ...f, pocs: f.pocs.filter((_, i) => i !== idx) }));
  }

  function updatePoc(idx: number, field: keyof ClientPoc, value: string) {
    setForm((f) => ({
      ...f,
      pocs: f.pocs.map((p, i) => (i === idx ? { ...p, [field]: value } : p)),
    }));
  }

  const activeRolesCount = (c: ClientWithRoles) =>
    c.roles.filter((r) => r.status === "Active").length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clients</h1>
          <p className="text-slate-500 text-sm mt-1">{clients.length} client{clients.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus size={16} /> Add Client
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Search clients..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table — desktop */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Points of Contact</TableHead>
              <TableHead>Active Roles</TableHead>
              <TableHead>Total Roles</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}><div className="h-4 bg-slate-100 rounded animate-pulse" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : clients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-slate-400">
                  <Building2 size={32} className="mx-auto mb-2 opacity-30" />
                  <p>No clients yet. Add your first client.</p>
                </TableCell>
              </TableRow>
            ) : (
              clients.map((client) => {
                const pocs = client.pocs as unknown as ClientPoc[];
                return (
                  <TableRow
                    key={client.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => openRoles(client)}
                  >
                    <TableCell className="font-mono text-xs text-slate-500">{client.clientId}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 font-medium">
                        {client.name}
                        <ChevronRight size={13} className="text-slate-300" />
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {pocs.length === 0 ? (
                        <span className="text-slate-300">—</span>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          {pocs.slice(0, 2).map((p, i) => (
                            <span key={i} className="truncate max-w-[180px]">
                              {p.name}{p.email ? <span className="text-slate-400 text-xs ml-1">({p.email})</span> : ""}
                            </span>
                          ))}
                          {pocs.length > 2 && (
                            <span className="text-xs text-slate-400">+{pocs.length - 2} more</span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        {activeRolesCount(client)} active
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">{client.roles.length}</TableCell>
                    <TableCell className="text-sm text-slate-500">{formatDate(client.createdAt)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => openEdit(e, client)}>
                          <Pencil size={13} />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(client); }}
                        >
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

      {/* Mobile cards — clients */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse space-y-3">
              <div className="h-4 bg-slate-100 rounded w-1/3" />
              <div className="h-3 bg-slate-100 rounded w-2/3" />
              <div className="h-3 bg-slate-100 rounded w-1/2" />
            </div>
          ))
        ) : clients.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Building2 size={32} className="mx-auto mb-2 opacity-30" />
            <p>No clients yet. Add your first client.</p>
          </div>
        ) : (
          clients.map((client) => {
            const pocs = client.pocs as unknown as ClientPoc[];
            return (
              <div
                key={client.id}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden cursor-pointer active:bg-slate-50"
                onClick={() => openRoles(client)}
              >
                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
                  <span className="font-mono text-xs text-slate-400 shrink-0">{client.clientId}</span>
                  <span className="font-semibold text-slate-900 truncate flex-1">{client.name}</span>
                  <ChevronRight size={13} className="text-slate-300 shrink-0" />
                  <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => openEdit(e, client)}><Pencil size={13} /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-50"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(client); }}><Trash2 size={13} /></Button>
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs text-slate-500">Active Roles</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                      {activeRolesCount(client)} active
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs text-slate-500">Total Roles</span>
                    <span className="text-sm text-slate-700">{client.roles.length}</span>
                  </div>
                  {pocs.length > 0 && (
                    <div className="flex items-start justify-between gap-4 px-4 py-2.5">
                      <span className="text-xs text-slate-500 shrink-0 mt-0.5">POC</span>
                      <div className="text-right space-y-0.5">
                        {pocs.slice(0, 2).map((p, i) => (
                          <div key={i} className="text-xs text-slate-700">
                            {p.name}{p.email ? <span className="text-slate-400 ml-1">({p.email})</span> : ""}
                          </div>
                        ))}
                        {pocs.length > 2 && <div className="text-xs text-slate-400">+{pocs.length - 2} more</div>}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs text-slate-500">Created</span>
                    <span className="text-xs text-slate-500">{formatDate(client.createdAt)}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Roles for Client dialog ── */}
      <Dialog open={rolesOpen} onOpenChange={setRolesOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 size={18} className="text-slate-400" />
              {selectedClient?.name}
              <span className="text-xs font-mono text-slate-400 font-normal ml-1">{selectedClient?.clientId}</span>
            </DialogTitle>
          </DialogHeader>

          {selectedClient && (
            <div className="space-y-4">
              {/* POCs summary */}
              {(selectedClient.pocs as unknown as ClientPoc[]).length > 0 && (
                <div className="flex flex-wrap gap-2 pb-3 border-b border-slate-100">
                  {(selectedClient.pocs as unknown as ClientPoc[]).map((p, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs bg-slate-50 border border-slate-200 rounded-full px-3 py-1">
                      <User size={11} className="text-slate-400" />
                      <span className="font-medium">{p.name}</span>
                      {p.email && (
                        <>
                          <span className="text-slate-300">·</span>
                          <Mail size={10} className="text-slate-400" />
                          <span className="text-slate-500">{p.email}</span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Roles table */}
              {selectedClient.roles.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <Building2 size={28} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No roles added for this client yet.</p>
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead>Role ID</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Openings</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedClient.roles.map((role) => (
                        <Link key={role.id} href={`/roles/${role.id}/kanban`} onClick={() => setRolesOpen(false)} className="contents">
                          <TableRow className="cursor-pointer hover:bg-slate-50">
                            <TableCell className="font-mono text-xs text-slate-500">{role.roleId}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5 font-medium text-sm">
                                {role.title}
                                <ChevronRight size={13} className="text-slate-300" />
                              </div>
                            </TableCell>
                            <TableCell><RoleStatusBadge status={role.status as RoleStatus} /></TableCell>
                            <TableCell className="text-sm text-slate-600">{role.openings}</TableCell>
                          </TableRow>
                        </Link>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Create / Edit Sheet ── */}
      <Sheet open={sheetOpen} onOpenChange={(o) => { setSheetOpen(o); if (!o) setEditingClient(null); }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingClient ? "Edit Client" : "Add Client"}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-5">
            {/* Name */}
            <div className="space-y-1.5">
              <Label>Client Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. TCS, Infosys"
              />
            </div>

            {/* POCs — merged name + email */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Points of Contact</Label>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={addPoc}>
                  <Plus size={12} /> Add POC
                </Button>
              </div>

              {form.pocs.map((poc, i) => (
                <div key={i} className="rounded-lg border border-slate-200 p-3 space-y-2 bg-slate-50/50 relative">
                  {form.pocs.length > 1 && (
                    <button
                      className="absolute top-2 right-2 text-slate-400 hover:text-red-500"
                      onClick={() => removePoc(i)}
                    >
                      <X size={13} />
                    </button>
                  )}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <User size={11} /> Name
                    </div>
                    <Input
                      value={poc.name}
                      onChange={(e) => updatePoc(i, "name", e.target.value)}
                      placeholder="e.g. Santhosh Kumar"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Mail size={11} /> Email
                    </div>
                    <Input
                      type="email"
                      value={poc.email}
                      onChange={(e) => updatePoc(i, "email", e.target.value)}
                      placeholder="santhosh@client.com"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Any additional notes..."
                rows={3}
              />
            </div>

            {saveMutation.error && (
              <p className="text-sm text-red-600">{(saveMutation.error as Error).message}</p>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setSheetOpen(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                disabled={saveMutation.isPending || !form.name}
                onClick={() => saveMutation.mutate(form)}
              >
                {saveMutation.isPending ? "Saving..." : editingClient ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Delete Confirmation ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Client</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This will also delete all associated roles and candidate mappings.
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive" size="sm"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
