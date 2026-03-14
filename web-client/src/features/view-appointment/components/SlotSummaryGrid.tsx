import { useMemo } from 'react';
import type { SlotGroup } from '../utils/groupSlotSummaries.js';
import type { ParticipantMatrixEntry } from '../utils/buildParticipantMatrix.js';
import { buildMonthlyCalendar } from '../utils/buildMonthlyCalendar.js';
import { MonthlyCalendar } from './MonthlyCalendar.js';
import { viewAppointmentStrings } from '../strings.js';
import { StatusMessage } from './StatusMessage.js';

type SlotSummaryGridProps = {
  slotGroups: SlotGroup[];
  participantCount: number;
  participantMatrix: ParticipantMatrixEntry[];
  onRetry?: () => void;
};

export function SlotSummaryGrid({ slotGroups, participantCount, participantMatrix, onRetry }: SlotSummaryGridProps) {
  const months = useMemo(() => buildMonthlyCalendar(slotGroups), [slotGroups]);

  if (slotGroups.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[var(--color-view-border)] p-6">
        <div className="mb-3 text-sm font-semibold text-slate-700">슬롯 현황</div>
        <StatusMessage
          variant="empty"
          label={viewAppointmentStrings.emptySlots}
          actionLabel={viewAppointmentStrings.retry}
          onRetry={onRetry}
        />
      </div>
    );
  }

  return (
    <section>
      <div className="mb-3 text-sm font-semibold text-slate-700">슬롯 현황</div>
      <MonthlyCalendar months={months} participantCount={participantCount} participantMatrix={participantMatrix} />
    </section>
  );
}
