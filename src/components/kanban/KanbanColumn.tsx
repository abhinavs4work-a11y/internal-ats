"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { KanbanColumn } from "@/types";
import { CandidateCard } from "./CandidateCard";
import { cn } from "@/lib/utils";

interface Props {
  column: KanbanColumn;
  onCardClick: (candidateId: string) => void;
}

export function KanbanColumnComponent({ column, onCardClick }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: column.status });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "w-60 shrink-0 rounded-xl border-2 transition-colors flex flex-col max-h-full",
        isOver
          ? "border-blue-400 bg-blue-50"
          : "border-slate-200 bg-slate-50"
      )}
    >
      {/* Column header */}
      <div className="p-3 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide truncate">
            {column.label}
          </h3>
          <span className="text-xs bg-slate-200 text-slate-600 rounded-full px-2 py-0.5 font-medium shrink-0">
            {column.cards.length}
          </span>
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[120px]">
        <SortableContext
          items={column.cards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {column.cards.map((card) => (
            <CandidateCard key={card.id} mapping={card} onClick={() => onCardClick(card.candidateId)} />
          ))}
        </SortableContext>
        {column.cards.length === 0 && (
          <div className={cn(
            "flex items-center justify-center rounded-lg border-2 border-dashed h-20 text-xs transition-colors",
            isOver ? "border-blue-400 text-blue-500 bg-blue-50" : "border-slate-200 text-slate-400"
          )}>
            Drop here
          </div>
        )}
      </div>
    </div>
  );
}
