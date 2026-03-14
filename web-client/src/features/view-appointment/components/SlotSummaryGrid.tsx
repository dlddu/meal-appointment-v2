import { useMemo } from 'react';
import type { SlotGroup } from '../utils/groupSlotSummaries.js';
import { buildWeeklyCalendar } from '../utils/buildWeeklyCalendar.js';
import { WeeklyCalendar } from './WeeklyCalendar.js';
import { viewAppointmentStrings } from '../strings.js';
import { StatusMessage } from './StatusMessage.js';

type SlotSummaryGridProps = {
  slotGroups: SlotGroup[];
  onRetry?: () => void;
};

export function SlotSummaryGrid({ slotGroups, onRetry }: SlotSummaryGridProps) {
  const weeks = useMemo(() => buildWeeklyCalendar(slotGroups), [slotGroups]);

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
      <WeeklyCalendar weeks={weeks} />
    </section>
  );
}
