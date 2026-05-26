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
} from "@dnd-kit/core";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { KanbanColumn, MappingWithDetails } from "@/types";
import { MappingStatus, RejectionReason } from "@prisma/client";
import { KanbanColumnComponent } from "./KanbanColumn";
import { CandidateCard } from "./CandidateCard";
import { RejectionModal } from "./RejectionModal";
import { CandidateDetailSheet } from "@/components/candidates/CandidateDetailSheet";

interface Props {
  roleId: string;
}

export function KanbanBoard({ roleId }: Props) {
  const [activeCard, setActiveCard] = useState<MappingWithDetails | null>(null);
  const [rejectionState, setRejectionState] = useState<{
    mappingId: string;
    newStatus: MappingStatus;
  } | null>(null);
  const [localColumns, setLocalColumns] = useState<KanbanColumn[] | null>(null);
  const [detailCandidateId, setDetailCandidateId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

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
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
    },
    onError: () => {
      // Rollback optimistic update
      setLocalColumns(serverColumns ?? null);
    },
  });

  function moveCard(mappingId: string, newStatus: MappingStatus) {
    // Optimistic update
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

    // over.id may be a column status (dropped on empty column area)
    // OR a card id (dropped on top of another card) — resolve column either way
    const columnStatuses = columns.map((c) => c.status) as string[];
    let newStatus: MappingStatus;

    if (columnStatuses.includes(over.id as string)) {
      newStatus = over.id as MappingStatus;
    } else {
      // over.id is a card id — find which column owns that card
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
    statusMutation.mutate({
      mappingId,
      newStatus,
      rejectionReason: reason,
      rejectionCustomReason: customReason,
    });
    setRejectionState(null);
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
        <DragOverlay>
          {activeCard && <CandidateCard mapping={activeCard} isDragging />}
        </DragOverlay>
      </DndContext>

      <RejectionModal
        open={!!rejectionState}
        onConfirm={handleRejectionConfirm}
        onCancel={() => {
          setRejectionState(null);
          setLocalColumns(serverColumns ?? null);
        }}
      />

      <CandidateDetailSheet
        candidateId={detailCandidateId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </>
  );
}
