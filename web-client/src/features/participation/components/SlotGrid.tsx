// Implemented for spec: agent/specs/meal-appointment-participation-frontend-implementation-spec.md

import { useMemo } from 'react';
import { participationStrings } from '../strings.js';
import { formatMealLabel, buildSlotLookup, MEAL_ROWS, getMealRowLabel, type SlotOption, type MealRow } from '../utils/slotKey.js';
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
  if (ratio >= 0.75) return 'text-[var(--participation-success)]';
  if (ratio >= 0.5) return 'text-[var(--participation-warning)]';
  return 'text-[var(--participation-error)]';
}

type DayColumn = {
  dateLabel: string;
  dayLabel: string;
};

function buildDayColumns(slots: SlotOption[]): DayColumn[] {
  const seen = new Map<string, DayColumn>();
  for (const slot of slots) {
    if (!seen.has(slot.dateLabel)) {
      seen.set(slot.dateLabel, { dateLabel: slot.dateLabel, dayLabel: slot.dayLabel });
    }
  }
  return Array.from(seen.values());
}

export function SlotGrid({ slots, selectedSlots, onToggleSlot, allowSelection, summaryMap, participantCount }: Props) {
  const lookup = useMemo(() => buildSlotLookup(slots), [slots]);
  const days = useMemo(() => buildDayColumns(slots), [slots]);

  if (slots.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--participation-border)] bg-white p-6 text-center text-sm text-slate-600">
        {participationStrings.emptySlots}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--participation-border)] bg-white shadow-[0_12px_24px_rgba(15,23,42,0.08)]">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr>
            <th className="w-16 border-b border-[var(--participation-border)] bg-[var(--participation-neutral-50)] px-3 py-2 text-left text-xs font-semibold text-slate-500" />
            {days.map((day) => (
              <th
                key={day.dateLabel}
                className="border-b border-[var(--participation-border)] bg-[var(--participation-neutral-50)] px-2 py-2 text-center"
              >
                <div className="text-xs text-slate-500">{day.dayLabel}</div>
                <div className="text-sm font-semibold text-slate-800">{day.dateLabel.slice(5)}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MEAL_ROWS.map((meal) => (
            <tr key={meal}>
              <td className="border-b border-[var(--participation-border)] bg-[var(--participation-neutral-50)] px-3 py-3 text-xs font-semibold text-slate-600">
                {getMealRowLabel(meal)}
              </td>
              {days.map((day) => {
                const slotKey = `${day.dateLabel}#${meal}`;
                const slot = lookup.get(slotKey);
                const isSelected = selectedSlots.includes(slotKey);
                const summary = summaryMap[slotKey];
                const ratio = summary?.availabilityRatio ?? 0;

                if (!slot) {
                  return (
                    <td
                      key={day.dateLabel}
                      className="border-b border-[var(--participation-border)] px-2 py-3 text-center"
                    >
                      <span className="text-xs text-slate-300">-</span>
                    </td>
                  );
                }

                return (
                  <td
                    key={day.dateLabel}
                    className="border-b border-[var(--participation-border)] px-1 py-1 text-center"
                  >
                    <button
                      type="button"
                      data-testid={`slot-${slotKey}`}
                      aria-pressed={isSelected}
                      aria-label={`${day.dateLabel} ${formatMealLabel(meal)}`}
                      disabled={!allowSelection}
                      onClick={() => onToggleSlot(slotKey)}
                      className={`w-full rounded-xl px-2 py-2 transition-colors focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[rgba(46,125,50,0.4)] ${
                        isSelected
                          ? 'bg-[rgba(46,125,50,0.12)] border-2 border-[var(--participation-primary)]'
                          : 'bg-transparent border-2 border-transparent hover:bg-[var(--participation-neutral-50)]'
                      } ${allowSelection ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}`}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        {isSelected && (
                          <span className="text-[var(--participation-primary)] text-base leading-none">✓</span>
                        )}
                        <span
                          className={`text-xs font-semibold ${badgeClass(ratio)}`}
                          aria-label={participationStrings.slotAvailableCount(summary?.availableCount ?? 0, participantCount)}
                        >
                          <span role="status">
                            {participationStrings.slotAvailableCount(summary?.availableCount ?? 0, participantCount)}
                          </span>
                        </span>
                      </div>
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
