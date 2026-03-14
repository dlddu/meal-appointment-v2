import { useState } from 'react';
import type { CalendarMonth } from '../utils/buildMonthlyCalendar.js';
import { MEAL_ROWS, getMealRowLabel } from '../utils/buildMonthlyCalendar.js';

type MonthlyCalendarProps = {
  months: CalendarMonth[];
  participantCount: number;
};

const toneStyles: Record<string, string> = {
  primary: 'text-[var(--color-view-primary)]',
  warning: 'text-[var(--color-view-warning)]',
  error: 'text-[#8A1C1C]'
};

const DAY_HEADERS = ['일', '월', '화', '수', '목', '금', '토'];

function dayHeaderClass(index: number): string {
  if (index === 0) return 'py-2 text-center text-xs font-semibold text-red-500';
  if (index === 6) return 'py-2 text-center text-xs font-semibold text-blue-500';
  return 'py-2 text-center text-xs font-semibold text-slate-500';
}

function dayNumberClass(dayIndex: number, isCurrentMonth: boolean): string {
  if (!isCurrentMonth) return 'text-[11px] text-slate-300';
  if (dayIndex === 0) return 'text-[11px] font-semibold text-red-500 mb-0.5 pl-0.5';
  if (dayIndex === 6) return 'text-[11px] font-semibold text-blue-500 mb-0.5 pl-0.5';
  return 'text-[11px] font-semibold text-slate-700 mb-0.5 pl-0.5';
}

export function MonthlyCalendar({ months, participantCount }: MonthlyCalendarProps) {
  const [monthIndex, setMonthIndex] = useState(0);
  const current = months[monthIndex];
  if (!current) return null;

  const hasPrev = monthIndex > 0;
  const hasNext = monthIndex < months.length - 1;

  return (
    <div className="space-y-3">
      {/* Month navigation */}
      {months.length > 1 && (
        <div className="flex items-center justify-between rounded-xl bg-white border border-[var(--color-view-border)] px-4 py-2">
          <button
            type="button"
            disabled={!hasPrev}
            onClick={() => setMonthIndex((i) => i - 1)}
            className="rounded-lg border border-[var(--color-view-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-view-neutral)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← 이전
          </button>
          <span className="text-sm font-semibold text-slate-700">
            {current.label}
          </span>
          <button
            type="button"
            disabled={!hasNext}
            onClick={() => setMonthIndex((i) => i + 1)}
            className="rounded-lg border border-[var(--color-view-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-view-neutral)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            다음 →
          </button>
        </div>
      )}

      {/* Single month - show label without navigation */}
      {months.length === 1 && (
        <div className="flex items-center justify-center rounded-xl bg-white border border-[var(--color-view-border)] px-4 py-2">
          <span className="text-sm font-semibold text-slate-700">
            {current.label}
          </span>
        </div>
      )}

      {/* Calendar grid */}
      <div className="rounded-2xl border border-[var(--color-view-border)] bg-white shadow-[0_12px_24px_rgba(15,23,42,0.08)] overflow-hidden">
        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 border-b border-[var(--color-view-border)] bg-[var(--color-view-neutral)]">
          {DAY_HEADERS.map((day, i) => (
            <div key={day} className={dayHeaderClass(i)}>
              {day}
            </div>
          ))}
        </div>

        {/* Weeks */}
        {current.weeks.map((week, wi) => (
          <div
            key={wi}
            className="grid grid-cols-7 border-b border-[var(--color-view-border)] last:border-b-0"
          >
            {week.map((cell, di) => {
              if (!cell.isCurrentMonth) {
                return (
                  <div
                    key={cell.date}
                    className="min-h-[68px] border-r border-[var(--color-view-border)] last:border-r-0 bg-slate-50 p-1"
                  >
                    <span className={dayNumberClass(di, false)}>{cell.dayOfMonth}</span>
                  </div>
                );
              }

              return (
                <div
                  key={cell.date}
                  className="min-h-[68px] border-r border-[var(--color-view-border)] last:border-r-0 p-0.5 sm:p-1"
                >
                  <div className={dayNumberClass(di, true)}>{cell.dayOfMonth}</div>
                  <div className="flex flex-col gap-px">
                    {MEAL_ROWS.map((meal) => {
                      const slot = cell.slots[meal];
                      if (!slot) return null;

                      return (
                        <div
                          key={meal}
                          className="w-full rounded py-0.5 text-[10px] leading-tight"
                        >
                          <div className="flex flex-col items-center leading-none">
                            <span className="font-medium text-slate-500">
                              {getMealRowLabel(meal)}
                            </span>
                            <span
                              className={`font-semibold text-[10px] ${toneStyles[slot.ratioTone]}`}
                            >
                              {slot.availableCount}/{participantCount}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
