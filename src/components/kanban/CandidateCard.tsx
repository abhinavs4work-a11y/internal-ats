"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { MappingWithDetails } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { GripVertical, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  mapping: MappingWithDetails;
  isDragging?: boolean;
  onClick?: () => void;
}

export function CandidateCard({ mapping, isDragging, onClick }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: mapping.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // Only fire click if it wasn't a drag (transform stays null on a pure click)
        if (!isSortableDragging && onClick) onClick();
      }}
      className={cn(
        "bg-white rounded-lg border border-slate-200 p-3 cursor-grab active:cursor-grabbing shadow-sm select-none",
        (isDragging || isSortableDragging) && "opacity-40 shadow-xl ring-2 ring-blue-400"
      )}
    >
      <div className="flex items-start gap-2">
        <div className="text-slate-300 mt-0.5 shrink-0 pointer-events-none">
          <GripVertical size={12} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">
            {mapping.candidate.fullName}
          </p>
          <p className="text-xs text-slate-400 font-mono">{mapping.candidate.candidateId}</p>

          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>Current</span>
              <span className="font-medium">{formatCurrency(Number(mapping.candidate.currentCtc) || null)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>Expected</span>
              <span className="font-medium text-blue-700">{formatCurrency(Number(mapping.candidate.expectedCtc) || null)}</span>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-1 text-xs text-slate-400">
            <User size={10} />
            <span className="truncate">{mapping.recruiter.name}</span>
          </div>

          {mapping.candidate.source && (
            <div className="mt-1">
              <span className="text-xs bg-slate-100 text-slate-500 rounded px-1.5 py-0.5">
                {mapping.candidate.source.replace(/([A-Z])/g, " $1").trim()}
              </span>
            </div>
          )}

          <p className="text-xs text-slate-400 mt-1">
            {formatDate(mapping.submissionDate)}
          </p>
        </div>
      </div>
    </div>
  );
}
