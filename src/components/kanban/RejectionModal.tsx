"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RejectionReason } from "@prisma/client";

const REJECTION_REASONS: Record<RejectionReason, string> = {
  BudgetMismatch: "Budget mismatch",
  PoorCommunication: "Poor communication",
  TechnicalRejection: "Technical rejection",
  CandidateNotInterested: "Candidate not interested",
  OfferDeclined: "Offer declined",
  PositionClosed: "Position closed",
  Other: "Other",
};

interface Props {
  open: boolean;
  onConfirm: (reason?: RejectionReason, customReason?: string) => void;
  onCancel: () => void;
}

export function RejectionModal({ open, onConfirm, onCancel }: Props) {
  const [reason, setReason] = useState<RejectionReason | "">("");
  const [customReason, setCustomReason] = useState("");

  function handleConfirm() {
    onConfirm(
      reason ? (reason as RejectionReason) : undefined,
      reason === "Other" ? customReason : undefined
    );
    setReason("");
    setCustomReason("");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Rejection Reason</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Reason (optional)</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as RejectionReason)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(REJECTION_REASONS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {reason === "Other" && (
            <div className="space-y-1.5">
              <Label>Custom Reason</Label>
              <Input
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Describe the reason..."
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button variant="destructive" size="sm" onClick={handleConfirm}>
            Mark as Rejected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
