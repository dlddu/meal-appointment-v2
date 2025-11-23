// Implemented for spec: agent/specs/meal-appointment-view-appointment-frontend-spec.md

import { viewAppointmentStrings } from '../strings.js';

type StatusMessageProps =
  | { variant: 'loading'; label?: string }
  | { variant: 'error'; label?: string; onRetry?: () => void }
  | { variant: 'empty'; label?: string; actionLabel?: string; onRetry?: () => void };

export function StatusMessage(props: StatusMessageProps) {
  if (props.variant === 'loading') {
    return (
      <div className="animate-pulse space-y-3" aria-live="polite">
        <div className="h-4 bg-gray-200 rounded" />
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-4 bg-gray-200 rounded w-1/2" />
        <span className="sr-only">{props.label ?? viewAppointmentStrings.loading}</span>
      </div>
    );
  }

  if (props.variant === 'error') {
    return (
      <div
        className="flex items-center justify-between gap-4 rounded-xl border border-[var(--color-view-error)] bg-[rgba(198,40,40,0.08)] p-4 text-[var(--color-view-error)]"
        role="alert"
      >
        <div className="font-semibold">{props.label ?? viewAppointmentStrings.temporaryFailure}</div>
        {props.onRetry && (
          <button
            type="button"
            onClick={props.onRetry}
            className="rounded-lg border border-[var(--color-view-error)] px-3 py-2 text-sm font-semibold"
            aria-label="데이터 다시 불러오기"
          >
            {viewAppointmentStrings.retry}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2 text-sm text-slate-600" aria-live="polite">
      <div className="flex items-center gap-2">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
          <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10 5.5v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="10" cy="13.5" r="0.75" fill="currentColor" />
        </svg>
        <span>{props.label ?? viewAppointmentStrings.emptyParticipants}</span>
      </div>
      {props.onRetry && props.actionLabel && (
        <button
          type="button"
          onClick={props.onRetry}
          className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-semibold"
        >
          {props.actionLabel}
        </button>
      )}
    </div>
  );
}
