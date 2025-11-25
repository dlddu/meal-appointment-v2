// Implemented for spec: agent/specs/meal-appointment-participation-frontend-implementation-spec.md

import { participationStrings } from '../strings.js';

export type SummaryPanelProps = {
  selectedCount: number;
  totalSlots: number;
  lastSubmittedAt?: string | null;
  onSubmit: () => void;
  onReset: () => void;
  isSubmitting: boolean;
  overwriteWarning?: boolean;
};

export function SummaryPanel({
  selectedCount,
  totalSlots,
  lastSubmittedAt,
  onSubmit,
  onReset,
  isSubmitting,
  overwriteWarning
}: SummaryPanelProps) {
  const unselected = Math.max(totalSlots - selectedCount, 0);
  return (
    <aside className="bg-white rounded-2xl border border-[var(--participation-border)] shadow-[0_12px_24px_rgba(15,23,42,0.08)] p-6 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{participationStrings.summaryTitle}</h2>
        {lastSubmittedAt && (
          <span className="text-xs text-slate-500" aria-live="polite">
            {participationStrings.lastSubmittedAt(lastSubmittedAt)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-4 text-sm text-slate-700">
        <span>{participationStrings.selectedCount(selectedCount)}</span>
        <span className="text-slate-400">|</span>
        <span>{participationStrings.unselectedCount(unselected)}</span>
      </div>
      {overwriteWarning && (
        <p className="text-sm text-[var(--participation-warning)]" role="status">
          {participationStrings.overwriteWarning}
        </p>
      )}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onReset}
          className="text-sm font-semibold text-slate-600 px-3 py-2 rounded-lg hover:bg-[var(--participation-neutral-50)] focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[rgba(21,101,192,0.45)]"
        >
          {participationStrings.resetSelection}
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting || totalSlots === 0}
          className="rounded-xl bg-[var(--participation-primary)] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_16px_rgba(46,125,50,0.22)] disabled:opacity-50 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[rgba(46,125,50,0.4)]"
        >
          {isSubmitting ? '제출 중...' : participationStrings.submitAvailability}
        </button>
      </div>
    </aside>
  );
}
