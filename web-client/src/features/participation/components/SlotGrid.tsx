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

const DAY_HEADERS = ['월', '화', '수', '목', '금', '토', '일'];

type CalendarCell = {
  date: string;
  dayOfMonth: number;
  isCurrentMonth: boolean;
};

function buildCalendarGrid(slots: SlotOption[]): CalendarCell[][] {
  if (slots.length === 0) return [];

  const dates = slots.map((s) => s.dateLabel).sort();
  const firstDate = new Date(dates[0] + 'T00:00:00Z');
  const lastDate = new Date(dates[dates.length - 1] + 'T00:00:00Z');

  const year = firstDate.getUTCFullYear();
  const month = firstDate.getUTCMonth();

  const monthStart = new Date(Date.UTC(year, month, 1));
  const monthEnd = new Date(Date.UTC(lastDate.getUTCFullYear(), lastDate.getUTCMonth() + 1, 0));

  // Monday = 0, Sunday = 6
  const startDow = (monthStart.getUTCDay() + 6) % 7;

  const gridStart = new Date(monthStart);
  gridStart.setUTCDate(gridStart.getUTCDate() - startDow);

  const totalDays = Math.ceil(
    (monthEnd.getTime() - gridStart.getTime()) / (1000 * 60 * 60 * 24) + 1
  );
  const totalWeeks = Math.ceil(totalDays / 7);

  const weeks: CalendarCell[][] = [];
  for (let w = 0; w < totalWeeks; w++) {
    const week: CalendarCell[] = [];
    for (let d = 0; d < 7; d++) {
      const current = new Date(gridStart);
      current.setUTCDate(gridStart.getUTCDate() + w * 7 + d);
      const dateStr = current.toISOString().slice(0, 10);
      week.push({
        date: dateStr,
        dayOfMonth: current.getUTCDate(),
        isCurrentMonth: current.getUTCMonth() === month && current.getUTCFullYear() === year
      });
    }
    weeks.push(week);
  }

  return weeks;
}

const SHORT_MEAL_LABELS: Record<string, string> = {
  LUNCH: '점',
  DINNER: '저'
};

function getShortMealLabel(meal: string): string {
  return SHORT_MEAL_LABELS[meal] ?? meal.charAt(0);
}

export function SlotGrid({ slots, selectedSlots, onToggleSlot, allowSelection, summaryMap, participantCount }: Props) {
  const lookup = useMemo(() => buildSlotLookup(slots), [slots]);
  const weeks = useMemo(() => buildCalendarGrid(slots), [slots]);
  const selectedSet = useMemo(() => new Set(selectedSlots), [selectedSlots]);

  if (slots.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--participation-border)] bg-white p-6 text-center text-sm text-slate-600">
        {participationStrings.emptySlots}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--participation-border)] bg-white shadow-[0_12px_24px_rgba(15,23,42,0.08)] overflow-hidden">
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 border-b border-[var(--participation-border)] bg-[var(--participation-neutral-50)]">
        {DAY_HEADERS.map((day) => (
          <div key={day} className="py-2 text-center text-xs font-semibold text-slate-500">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      {weeks.map((week, wi) => (
        <div
          key={wi}
          className="grid grid-cols-7 border-b border-[var(--participation-border)] last:border-b-0"
        >
          {week.map((cell) => {
            if (!cell.isCurrentMonth) {
              return (
                <div
                  key={cell.date}
                  className="min-h-[68px] border-r border-[var(--participation-border)] last:border-r-0 bg-slate-50 p-1"
                >
                  <span className="text-[11px] text-slate-300">{cell.dayOfMonth}</span>
                </div>
              );
            }

            return (
              <div
                key={cell.date}
                className="min-h-[68px] border-r border-[var(--participation-border)] last:border-r-0 p-0.5 sm:p-1"
              >
                <div className="text-[11px] font-semibold text-slate-700 mb-0.5 pl-0.5">{cell.dayOfMonth}</div>
                <div className="flex flex-col gap-px">
                  {MEAL_ROWS.map((meal) => {
                    const slotKey = `${cell.date}#${meal}`;
                    const slot = lookup.get(slotKey);
                    if (!slot) return null;

                    const isSelected = selectedSet.has(slotKey);
                    const summary = summaryMap[slotKey];
                    const ratio = summary?.availabilityRatio ?? 0;

                    return (
                      <button
                        key={meal}
                        type="button"
                        data-testid={`slot-${slotKey}`}
                        aria-pressed={isSelected}
                        aria-label={`${cell.date} ${formatMealLabel(meal)}`}
                        disabled={!allowSelection}
                        onClick={() => onToggleSlot(slotKey)}
                        className={`w-full rounded py-0.5 text-[10px] leading-tight transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[rgba(46,125,50,0.4)] ${
                          isSelected
                            ? 'bg-[rgba(46,125,50,0.12)] ring-1 ring-[var(--participation-primary)]'
                            : 'bg-transparent hover:bg-[var(--participation-neutral-50)]'
                        } ${allowSelection ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}`}
                      >
                        <div className="flex flex-col items-center leading-none">
                          <span className="flex items-center gap-px">
                            {isSelected && (
                              <span className="text-[var(--participation-primary)] text-[10px] leading-none">✓</span>
                            )}
                            <span className="font-medium text-slate-500">{getShortMealLabel(meal)}</span>
                          </span>
                          <span
                            className={`font-semibold text-[10px] ${badgeClass(ratio)}`}
                            aria-label={participationStrings.slotAvailableCount(summary?.availableCount ?? 0, participantCount)}
                          >
                            <span role="status">
                              {participationStrings.slotAvailableCount(summary?.availableCount ?? 0, participantCount)}
                            </span>
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
