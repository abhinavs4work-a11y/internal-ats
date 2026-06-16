"use client";

import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCorners,
  useDroppable,
} from "@dnd-kit/core";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { KanbanColumn, MappingWithDetails } from "@/types";
import { MappingStatus, RejectionReason } from "@prisma/client";
import { KanbanColumnComponent } from "./KanbanColumn";
import { CandidateCard } from "./CandidateCard";
import { RejectionModal } from "./RejectionModal";
import { CandidateDetailSheet } from "@/components/candidates/CandidateDetailSheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const DELETE_ZONE_ID = "DELETE_ZONE";

function DeleteZone({ visible }: { visible: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: DELETE_ZONE_ID });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2.5 px-6 py-3 rounded-2xl border-2 transition-all duration-200 select-none cursor-default",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6 pointer-events-none",
        isOver
          ? "bg-red-500 border-red-500 text-white shadow-2xl shadow-red-500/40 scale-105"
          : "bg-white border-red-300 text-red-500 shadow-lg"
      )}
    >
      <Trash2 size={15} />
      <span className="text-sm font-semibold whitespace-nowrap">Remove from role</span>
    </div>
  );
}

interface Props {
  roleId: string;
}

export function KanbanBoard({ roleId }: Props) {
  const [activeCard, setActiveCard]   = useState<MappingWithDetails | null>(null);
  const [rejectionState, setRejectionState] = useState<{
    mappingId: string;
    newStatus: MappingStatus;
  } | null>(null);
  const [deleteConfirmState, setDeleteConfirmState] = useState<{
    mappingId: string;
    candidateName: string;
  } | null>(null);
  const [localColumns, setLocalColumns]   = useState<KanbanColumn[] | null>(null);
  const [detailCandidateId, setDetailCandidateId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen]       = useState(false);

  const queryClient = useQueryClient();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const { data: serverColumns, isLoading } = useQuery<KanbanColumn[]>({
    queryKey: ["kanban", roleId],
    queryFn: async () => {
      const res = await fetch(`/api/roles/${roleId}/kanban`);
      const data: KanbanColumn[] = await res.json();
      setLocalColumns(data);
      return data;
    },
  });

  const columns = localColumns ?? serverColumns ?? [];

  const statusMutation = useMutation({
    mutationFn: async ({
      mappingId,
      newStatus,
      rejectionReason,
      rejectionCustomReason,
    }: {
      mappingId: string;
      newStatus: MappingStatus;
      rejectionReason?: RejectionReason;
      rejectionCustomReason?: string;
    }) => {
      const res = await fetch(`/api/mappings/${mappingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, rejectionReason, rejectionCustomReason }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kanban", roleId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => {
      setLocalColumns(serverColumns ?? null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (mappingId: string) => {
      const res = await fetch(`/api/mappings/${mappingId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove mapping");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kanban", roleId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => {
      setLocalColumns(serverColumns ?? null);
    },
  });

  function moveCard(mappingId: string, newStatus: MappingStatus) {
    setLocalColumns((prev) => {
      if (!prev) return prev;
      let card: MappingWithDetails | undefined;
      const updated = prev.map((col) => {
        const found = col.cards.find((c) => c.id === mappingId);
        if (found) card = found;
        return { ...col, cards: col.cards.filter((c) => c.id !== mappingId) };
      });
      if (!card) return prev;
      const updatedCard = { ...card, status: newStatus };
      return updated.map((col) =>
        col.status === newStatus
          ? { ...col, cards: [...col.cards, updatedCard] }
          : col
      );
    });
  }

  function removeCard(mappingId: string) {
    setLocalColumns((prev) => {
      if (!prev) return prev;
      return prev.map((col) => ({
        ...col,
        cards: col.cards.filter((c) => c.id !== mappingId),
      }));
    });
  }

  function handleDragStart(event: DragStartEvent) {
    const card = columns
      .flatMap((c) => c.cards)
      .find((c) => c.id === event.active.id);
    setActiveCard(card ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveCard(null);

    if (!over) return;

    const mappingId = active.id as string;

    // Dropped on the delete zone → ask for confirmation
    if (over.id === DELETE_ZONE_ID) {
      const card = columns.flatMap((c) => c.cards).find((c) => c.id === mappingId);
      if (card) {
        setDeleteConfirmState({ mappingId, candidateName: card.candidate.fullName });
      }
      return;
    }

    const columnStatuses = columns.map((c) => c.status) as string[];
    let newStatus: MappingStatus;

    if (columnStatuses.includes(over.id as string)) {
      newStatus = over.id as MappingStatus;
    } else {
      const targetCol = columns.find((c) => c.cards.some((card) => card.id === over.id));
      if (!targetCol) return;
      newStatus = targetCol.status as MappingStatus;
    }

    const currentCol = columns.find((c) => c.cards.some((card) => card.id === mappingId));
    if (!currentCol || currentCol.status === newStatus) return;

    if (newStatus === MappingStatus.Rejected) {
      setRejectionState({ mappingId, newStatus });
      return;
    }

    moveCard(mappingId, newStatus);
    statusMutation.mutate({ mappingId, newStatus });
  }

  function handleRejectionConfirm(reason?: RejectionReason, customReason?: string) {
    if (!rejectionState) return;
    const { mappingId, newStatus } = rejectionState;
    moveCard(mappingId, newStatus);
    statusMutation.mutate({ mappingId, newStatus, rejectionReason: reason, rejectionCustomReason: customReason });
    setRejectionState(null);
  }

  function handleDeleteConfirm() {
    if (!deleteConfirmState) return;
    const { mappingId } = deleteConfirmState;
    removeCard(mappingId);
    deleteMutation.mutate(mappingId);
    setDeleteConfirmState(null);
  }

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="w-64 shrink-0 bg-slate-100 rounded-xl h-96 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-4 h-full">
          {columns.map((col) => (
            <KanbanColumnComponent
              key={col.status}
              column={col}
              onCardClick={(candidateId) => { setDetailCandidateId(candidateId); setDetailOpen(true); }}
            />
          ))}
        </div>

        {/* Delete zone — appears while dragging */}
        <DeleteZone visible={activeCard !== null} />

        <DragOverlay>
          {activeCard && <CandidateCard mapping={activeCard} isDragging />}
        </DragOverlay>
      </DndContext>

      {/* Rejection modal */}
      <RejectionModal
        open={!!rejectionState}
        onConfirm={handleRejectionConfirm}
        onCancel={() => {
          setRejectionState(null);
          setLocalColumns(serverColumns ?? null);
        }}
      />

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteConfirmState} onOpenChange={(o) => !o && setDeleteConfirmState(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove from role?</DialogTitle>
            <DialogDescription>
              This will unmap <strong>{deleteConfirmState?.candidateName}</strong> from this role.
              All pipeline history for this mapping will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirmState(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleteMutation.isPending}
              onClick={handleDeleteConfirm}
            >
              {deleteMutation.isPending ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CandidateDetailSheet
        candidateId={detailCandidateId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </>
  );
}
