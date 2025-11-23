// Implemented for spec: agent/specs/meal-appointment-view-appointment-frontend-spec.md

import { useMemo, useState } from 'react';
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
  const [menuOpen, setMenuOpen] = useState(false);

  const actions = useMemo(
    () => [
      onShare && { label: viewAppointmentStrings.share, onClick: onShare },
      onNavigateToRespond && { label: viewAppointmentStrings.respond, onClick: onNavigateToRespond }
    ].filter(Boolean) as Array<{ label: string; onClick: () => void }>,
    [onNavigateToRespond, onShare]
  );

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 bg-white px-6 shadow-[0_1px_2px_rgba(15,23,42,0.08)]">
      <div className="flex flex-1 items-center gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-xl bg-[var(--color-view-primary)] px-4 py-2 text-sm font-semibold text-white focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-view-secondary)]"
          aria-label="데이터 다시 불러오기"
        >
          {viewAppointmentStrings.retry}
        </button>
        <div className="flex flex-col">
          <span className="text-lg font-semibold text-slate-900">{title}</span>
          {isLoading && <span className="text-xs text-slate-500" aria-live="polite">불러오는 중...</span>}
        </div>
      </div>
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
      <div className="sm:hidden">
        <button
          type="button"
          className="rounded-full border border-slate-300 p-2"
          aria-label="메뉴 열기"
          onClick={() => setMenuOpen((prev) => !prev)}
        >
          ☰
        </button>
        {menuOpen && actions.length > 0 && (
          <div className="absolute right-4 top-16 w-48 rounded-xl border border-[var(--color-view-border)] bg-white p-2 shadow-lg">
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--color-view-neutral)]"
                onClick={() => {
                  action.onClick();
                  setMenuOpen(false);
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
