// Implemented for spec: agent/specs/meal-appointment-participation-frontend-implementation-spec.md

import { useMemo } from 'react';
import { participationStrings } from '../strings.js';

export type ParticipantCardProps = {
  nickname: string;
  pin: string;
  onChangeNickname: (value: string) => void;
  onChangePin: (value: string) => void;
  onTogglePersist: (value: boolean) => void;
  isPersistedLocally: boolean;
  statusBadge?: { variant: 'success' | 'error'; label: string; caption?: string } | null;
  onStart: () => void;
  isBusy: boolean;
  errorMessage?: string | null;
};

export function ParticipantInfoCard({
  nickname,
  pin,
  onChangeNickname,
  onChangePin,
  onTogglePersist,
  isPersistedLocally,
  statusBadge,
  onStart,
  isBusy,
  errorMessage
}: ParticipantCardProps) {
  const badgeClass = useMemo(() => {
    if (!statusBadge) return '';
    if (statusBadge.variant === 'success') return 'bg-[var(--participation-neutral-50)] text-[var(--participation-success)]';
    return 'bg-[var(--participation-neutral-50)] text-[var(--participation-error)]';
  }, [statusBadge]);

  return (
    <div className="bg-white rounded-2xl border border-[var(--participation-border)] shadow-[0_12px_24px_rgba(15,23,42,0.08)] p-7 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">닉네임과 PIN을 입력하세요</p>
          {statusBadge && (
            <div className={`mt-1 inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold ${badgeClass}`}>
              <span aria-live="polite">{statusBadge.label}</span>
              {statusBadge.caption && <span className="text-xs text-slate-500">{statusBadge.caption}</span>}
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="flex flex-col gap-2 text-sm font-semibold text-slate-800">
          {participationStrings.nicknameLabel}
          <input
            value={nickname}
            onChange={(e) => onChangeNickname(e.target.value)}
            type="text"
            aria-label={participationStrings.nicknameLabel}
            className="rounded-xl border border-[var(--participation-border)] px-3 py-2 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[rgba(21,101,192,0.45)]"
            maxLength={40}
          />
        </label>
        <div className="flex flex-col gap-2 text-sm font-semibold text-slate-800">
          <label className="flex flex-col gap-2">
            {participationStrings.pinLabel}
            <input
              value={pin}
              onChange={(e) => onChangePin(e.target.value)}
              type="password"
              aria-label={participationStrings.pinLabel}
              className="rounded-xl border border-[var(--participation-border)] px-3 py-2 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[rgba(21,101,192,0.45)]"
              maxLength={12}
            />
          </label>
          {errorMessage && (
            <p className="text-sm font-normal text-[var(--participation-error)]" role="alert">
              {errorMessage}
            </p>
          )}
        </div>
      </div>
      <label className="flex items-center gap-3 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={isPersistedLocally}
          onChange={(e) => onTogglePersist(e.target.checked)}
          aria-label={participationStrings.saveToDevice}
          className="h-4 w-4 rounded border-[var(--participation-border)]"
        />
        <div>
          <p className="font-semibold">{participationStrings.saveToDevice}</p>
          <p className="text-xs text-slate-500">{participationStrings.saveWarning}</p>
        </div>
      </label>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onStart}
          disabled={isBusy}
          className="rounded-xl bg-[var(--participation-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[rgba(46,125,50,0.4)]"
        >
          {isBusy ? '진행 중...' : participationStrings.startParticipation}
        </button>
      </div>
    </div>
  );
}
