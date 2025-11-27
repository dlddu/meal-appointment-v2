// Implemented for spec: agent/specs/meal-appointment-view-appointment-frontend-spec.md

import { useMemo } from 'react';
import { viewAppointmentStrings } from '../strings.js';

type ViewAppointmentAppBarProps = {
  title: string;
  isLoading?: boolean;
  onRetry?: () => void;
  onShare?: () => Promise<void> | void;
  onNavigateToRespond?: () => void;
};

export function ViewAppointmentAppBar({
  title,
  isLoading,
  onRetry,
  onShare,
  onNavigateToRespond
}: ViewAppointmentAppBarProps) {
  const actions = useMemo(
    () => [
      onShare && { label: viewAppointmentStrings.share, onClick: onShare },
      onNavigateToRespond && { label: viewAppointmentStrings.respond, onClick: onNavigateToRespond }
    ].filter(Boolean) as Array<{ label: string; onClick: () => void }>,
    [onNavigateToRespond, onShare]
  );

  return (
    <header className="sticky top-0 z-10 flex flex-col gap-3 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.08)] sm:h-16 sm:flex-row sm:items-center sm:gap-4 sm:px-6 sm:py-0">
      <div className="flex flex-1 items-start gap-3 sm:items-center">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-xl bg-[var(--color-view-primary)] px-4 py-2 text-sm font-semibold text-white focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-view-secondary)]"
          aria-label="데이터 다시 불러오기"
        >
          {viewAppointmentStrings.retry}
        </button>
        <div className="flex min-w-0 flex-col">
          <span className="text-lg font-semibold text-slate-900 sm:truncate">{title}</span>
          {isLoading && <span className="text-xs text-slate-500" aria-live="polite">불러오는 중...</span>}
        </div>
      </div>
      {actions.length > 0 && (
        <>
          <div className="hidden items-center gap-2 sm:flex">
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={action.onClick}
                className="rounded-xl bg-[var(--color-view-secondary)] px-4 py-2 text-sm font-semibold text-white focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-view-secondary)]"
              >
                {action.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap justify-end gap-2 sm:hidden">
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={action.onClick}
                className="rounded-lg bg-[var(--color-view-secondary)] px-3 py-2 text-sm font-semibold text-white focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-view-secondary)]"
              >
                {action.label}
              </button>
            ))}
          </div>
        </>
      )}
    </header>
  );
}
