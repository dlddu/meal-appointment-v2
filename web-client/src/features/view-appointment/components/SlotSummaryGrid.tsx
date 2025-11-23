// Implemented for spec: agent/specs/meal-appointment-view-appointment-frontend-spec.md

import type { SlotGroup } from '../utils/groupSlotSummaries.js';
import { viewAppointmentStrings } from '../strings.js';
import { StatusMessage } from './StatusMessage.js';

type SlotSummaryGridProps = {
  slotGroups: SlotGroup[];
  participantCount: number;
  onRetry?: () => void;
};

const toneStyles: Record<string, string> = {
  primary: 'bg-[rgba(46,125,50,0.1)] text-[var(--color-view-primary)]',
  warning: 'bg-[rgba(249,168,37,0.12)] text-[var(--color-view-warning)]',
  error: 'bg-[rgba(198,40,40,0.08)] text-[#8A1C1C]'
};

export function SlotSummaryGrid({ slotGroups, participantCount, onRetry }: SlotSummaryGridProps) {
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {slotGroups.map((group) => (
          <article
            key={group.date}
            className="bg-white rounded-2xl border border-[var(--color-view-border)] shadow-[0_12px_24px_rgba(15,23,42,0.08)] p-6"
          >
            <header className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-500">{group.weekdayLabel}</div>
                <div className="text-xl font-semibold text-slate-900">{group.displayDate}</div>
              </div>
              <span className="rounded-lg bg-[var(--color-view-neutral)] px-3 py-1 text-sm font-semibold text-slate-700">
                응답 {participantCount}
              </span>
            </header>
            <div className="space-y-3">
              {group.summaries.map((summary) => (
                <div
                  key={summary.slotKey}
                  className="rounded-xl border border-[var(--color-view-border)] px-4 py-3"
                >
                  <div className="flex items-center justify-between text-sm text-slate-700">
                    <span className="rounded-full bg-[var(--color-view-neutral)] px-3 py-1 text-xs font-semibold">
                      {summary.mealLabel}
                    </span>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${toneStyles[summary.ratioTone]}`}>
                      {summary.ratioLabel}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-sm text-slate-600">
                    <div className="flex flex-col rounded-lg bg-[var(--color-view-neutral)] px-3 py-2">
                      <span className="text-xs text-slate-500">가능</span>
                      <strong className="text-base text-slate-900">{summary.availableCount}</strong>
                    </div>
                    <div className="flex flex-col rounded-lg bg-[var(--color-view-neutral)] px-3 py-2">
                      <span className="text-xs text-slate-500">응답</span>
                      <strong className="text-base text-slate-900">{participantCount}</strong>
                    </div>
                    <div className="flex flex-col rounded-lg bg-[var(--color-view-neutral)] px-3 py-2">
                      <span className="text-xs text-slate-500">응답률</span>
                      <strong className="text-base text-slate-900">{summary.ratioLabel}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
