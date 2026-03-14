import { useEffect, useRef } from 'react';
import type { ParticipantMatrixEntry } from '../utils/buildParticipantMatrix.js';

type SlotParticipantModalProps = {
  entry: ParticipantMatrixEntry;
  participantCount: number;
  onClose: () => void;
};

export function SlotParticipantModal({ entry, participantCount, onClose }: SlotParticipantModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label={`${entry.displayLabel} 참석자 목록`}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-view-border)] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{entry.displayLabel}</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {entry.participants.length}/{participantCount}명 참석 가능
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-view-secondary)]"
            aria-label="닫기"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {entry.participants.length === 0 ? (
            <p className="text-sm text-slate-500">참석 가능한 응답자가 없습니다</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {entry.participants.map((nickname) => (
                <span
                  key={nickname}
                  className="rounded-full bg-[var(--color-view-secondary)]/10 px-3 py-1.5 text-sm font-medium text-[var(--color-view-secondary)]"
                >
                  {nickname}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--color-view-border)] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-[var(--color-view-neutral)] px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
