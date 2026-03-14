// Implemented for spec: agent/specs/meal-appointment-view-appointment-frontend-spec.md

import { useMemo, useState, type KeyboardEvent } from 'react';
import type { AppointmentViewResponse } from '../api/getAppointment.js';
import { viewAppointmentStrings } from '../strings.js';
import { formatSlotKey } from '../utils/formatSlot.js';
import type { ParticipantMatrixEntry } from '../utils/buildParticipantMatrix.js';
import { StatusMessage } from './StatusMessage.js';

type ParticipantTabsProps = {
  participants: AppointmentViewResponse['participants'];
  participantMatrix: ParticipantMatrixEntry[];
};

function formatSubmittedAt(date: string) {
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date));
}

const mealOrder: Record<string, number> = { BREAKFAST: 0, LUNCH: 1, DINNER: 2 };

function sortSlotKeys(slotKeys: string[]): string[] {
  return [...slotKeys].sort((a, b) => {
    const [dateA, mealA] = a.split('#');
    const [dateB, mealB] = b.split('#');
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return (mealOrder[mealA] ?? 9) - (mealOrder[mealB] ?? 9);
  });
}

export function ParticipantTabs({ participants, participantMatrix }: ParticipantTabsProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [minParticipants, setMinParticipants] = useState(0);

  const filterOptions = useMemo(() => {
    const max = participants.length;
    return Array.from({ length: max + 1 }, (_, i) => i);
  }, [participants.length]);

  const filteredMatrix = useMemo(
    () =>
      minParticipants > 0
        ? participantMatrix.filter((entry) => entry.participants.length >= minParticipants)
        : participantMatrix,
    [participantMatrix, minParticipants]
  );

  const tabs = useMemo(
    () => [
      { id: 'responders', label: viewAppointmentStrings.participantsTab },
      { id: 'slots', label: viewAppointmentStrings.slotDetailsTab }
    ],
    []
  );

  const handleKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight') {
      setActiveIndex((prev) => (prev + 1) % tabs.length);
    }
    if (event.key === 'ArrowLeft') {
      setActiveIndex((prev) => (prev - 1 + tabs.length) % tabs.length);
    }
  };

  return (
    <section className="bg-white rounded-2xl border border-[var(--color-view-border)] shadow-[0_12px_24px_rgba(15,23,42,0.08)] p-7 sm:p-6">
      <div
        className="flex items-center gap-2 overflow-x-auto pb-2"
        role="tablist"
        aria-label="응답 현황 탭"
        onKeyDown={handleKey}
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeIndex === index}
            aria-controls={`${tab.id}-panel`}
            id={`${tab.id}-tab`}
            className={`rounded-full px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-[var(--color-view-secondary)] focus-visible:ring-offset-2 ${
              activeIndex === index
                ? 'bg-[var(--color-view-secondary)] text-white'
                : 'bg-[var(--color-view-neutral)] text-slate-700'
            }`}
            onClick={() => setActiveIndex(index)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {activeIndex === 0 && (
          <div role="tabpanel" id="responders-panel" aria-labelledby="responders-tab" className="space-y-3">
            {participants.length === 0 ? (
              <StatusMessage variant="empty" label={viewAppointmentStrings.emptyParticipants} />
            ) : (
              participants.map((participant) => (
                <div
                  key={participant.participantId}
                  className="rounded-xl border border-[var(--color-view-border)] bg-[var(--color-view-neutral)] px-4 py-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-base font-semibold text-slate-900">{participant.nickname}</div>
                    <div className="text-xs text-slate-500">{formatSubmittedAt(participant.submittedAt)}</div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {participant.responses.length === 0 ? (
                      <span className="text-xs text-slate-500">선택한 슬롯이 없습니다</span>
                    ) : (
                      sortSlotKeys(participant.responses).map((slotKey) => (
                        <span
                          key={slotKey}
                          className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 border border-[var(--color-view-border)]"
                        >
                          {formatSlotKey(slotKey)}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeIndex === 1 && (
          <div role="tabpanel" id="slots-panel" aria-labelledby="slots-tab" className="space-y-3">
            {participantMatrix.length === 0 ? (
              <StatusMessage variant="empty" label="슬롯 응답 정보가 없습니다" />
            ) : (
              <>
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <label htmlFor="min-participants-filter" className="font-medium whitespace-nowrap">
                    최소 인원 필터
                  </label>
                  <select
                    id="min-participants-filter"
                    value={minParticipants}
                    onChange={(e) => setMinParticipants(Number(e.target.value))}
                    className="rounded-lg border border-[var(--color-view-border)] px-2 py-1 text-sm"
                  >
                    {filterOptions.map((n) => (
                      <option key={n} value={n}>
                        {n === 0 ? '전체' : `${n}명 이상`}
                      </option>
                    ))}
                  </select>
                </div>
                {filteredMatrix.length === 0 ? (
                  <StatusMessage variant="empty" label="조건에 맞는 슬롯이 없습니다" />
                ) : (
                  filteredMatrix.map((entry) => (
                <div
                  key={entry.slotKey}
                  className="rounded-xl border border-[var(--color-view-border)] bg-[var(--color-view-neutral)] px-4 py-3"
                >
                  <div className="mb-2 text-sm font-semibold text-slate-900">{entry.displayLabel}</div>
                  {entry.participants.length === 0 ? (
                    <span className="text-xs text-slate-500">응답자가 없습니다</span>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {entry.participants.map((nickname) => (
                        <span
                          key={nickname + entry.slotKey}
                          className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 border border-[var(--color-view-border)]"
                        >
                          {nickname}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
                )}
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
