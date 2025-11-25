// Implemented for spec: agent/specs/meal-appointment-participation-frontend-implementation-spec.md

import { participationStrings } from '../strings.js';
import type { SlotOption } from '../utils/slotKey.js';
import type { ParticipationSlotSummary } from '../api/getAppointmentTemplate.js';

type Props = {
  slots: SlotOption[];
  selectedSlots: string[];
  onToggleSlot: (slotKey: string) => void;
  allowSelection: boolean;
  summaryMap: Record<string, ParticipationSlotSummary>;
  participantCount: number;
};

function badgeClass(ratio: number): string {
  if (ratio >= 0.75) return 'bg-[var(--participation-neutral-50)] text-[var(--participation-success)]';
  if (ratio >= 0.5) return 'bg-[var(--participation-neutral-50)] text-[var(--participation-warning)]';
  return 'bg-[var(--participation-neutral-50)] text-[var(--participation-error)]';
}

export function SlotGrid({ slots, selectedSlots, onToggleSlot, allowSelection, summaryMap, participantCount }: Props) {
  if (slots.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--participation-border)] bg-white p-6 text-center text-sm text-slate-600">
        {participationStrings.emptySlots}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {slots.map((slot) => {
        const isSelected = selectedSlots.includes(slot.slotKey);
        const summary = summaryMap[slot.slotKey];
        const ratio = summary?.availabilityRatio ?? 0;
        return (
          <button
            key={slot.slotKey}
            type="button"
            data-testid={`slot-${slot.slotKey}`}
            aria-pressed={isSelected}
            aria-label={`${slot.dateLabel} ${slot.mealType}`}
            disabled={!allowSelection}
            onClick={() => onToggleSlot(slot.slotKey)}
            className={`text-left rounded-2xl border px-4 py-3 shadow-[0_12px_24px_rgba(15,23,42,0.08)] focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[rgba(46,125,50,0.4)] ${
              isSelected
                ? 'border-[var(--participation-primary)] bg-[rgba(46,125,50,0.08)]'
                : 'border-[var(--participation-border)] bg-white'
            } ${allowSelection ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">{slot.dayLabel}</p>
                <p className="text-lg font-semibold text-slate-900">{slot.mealType}</p>
                <p className="text-sm text-slate-700">{slot.dateLabel}</p>
              </div>
              <div
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(ratio)}`}
                aria-label={participationStrings.slotAvailableCount(summary?.availableCount ?? 0, participantCount)}
              >
                <span role="status">
                  {participationStrings.slotAvailableCount(summary?.availableCount ?? 0, participantCount)}
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
