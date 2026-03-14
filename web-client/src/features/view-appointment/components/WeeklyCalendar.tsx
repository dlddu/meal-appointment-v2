import { useState } from 'react';
import type { CalendarWeek } from '../utils/buildWeeklyCalendar.js';
import { MEAL_ROWS, getMealRowLabel } from '../utils/buildWeeklyCalendar.js';

type WeeklyCalendarProps = {
  weeks: CalendarWeek[];
};

const toneStyles: Record<string, string> = {
  primary: 'bg-[rgba(46,125,50,0.1)] text-[var(--color-view-primary)]',
  warning: 'bg-[rgba(249,168,37,0.12)] text-[var(--color-view-warning)]',
  error: 'bg-[rgba(198,40,40,0.08)] text-[#8A1C1C]'
};

export function WeeklyCalendar({ weeks }: WeeklyCalendarProps) {
  const [weekIndex, setWeekIndex] = useState(0);
  const week = weeks[weekIndex];
  if (!week) return null;

  const hasPrev = weekIndex > 0;
  const hasNext = weekIndex < weeks.length - 1;

  return (
    <div className="space-y-3">
      {/* Week navigation */}
      {weeks.length > 1 && (
        <div className="flex items-center justify-between rounded-xl bg-white border border-[var(--color-view-border)] px-4 py-2">
          <button
            type="button"
            disabled={!hasPrev}
            onClick={() => setWeekIndex((i) => i - 1)}
            className="rounded-lg border border-[var(--color-view-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-view-neutral)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← 이전
          </button>
          <span className="text-sm font-semibold text-slate-700">
            {week.weekStart} ~ {week.weekEnd}
          </span>
          <button
            type="button"
            disabled={!hasNext}
            onClick={() => setWeekIndex((i) => i + 1)}
            className="rounded-lg border border-[var(--color-view-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-view-neutral)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            다음 →
          </button>
        </div>
      )}

      {/* Calendar table */}
      <div className="overflow-x-auto rounded-2xl border border-[var(--color-view-border)] bg-white shadow-[0_12px_24px_rgba(15,23,42,0.08)]">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-16 border-b border-[var(--color-view-border)] bg-[var(--color-view-neutral)] px-3 py-2 text-left text-xs font-semibold text-slate-500" />
              {week.days.map((day) => (
                <th
                  key={day.date}
                  className="border-b border-[var(--color-view-border)] bg-[var(--color-view-neutral)] px-2 py-2 text-center"
                >
                  <div className="text-xs text-slate-500">{day.weekdayLabel}</div>
                  <div className="text-sm font-semibold text-slate-800">{day.displayDate}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MEAL_ROWS.map((meal) => (
              <tr key={meal}>
                <td className="border-b border-[var(--color-view-border)] bg-[var(--color-view-neutral)] px-3 py-3 text-xs font-semibold text-slate-600">
                  {getMealRowLabel(meal)}
                </td>
                {week.days.map((day) => {
                  const slot = day.slots[meal];
                  return (
                    <td
                      key={day.date}
                      className="border-b border-[var(--color-view-border)] px-2 py-3 text-center"
                    >
                      {slot ? (
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-base font-semibold text-slate-900">
                            {slot.availableCount}
                          </span>
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${toneStyles[slot.ratioTone]}`}
                          >
                            {slot.ratioLabel}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-300">-</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
