// Implemented for spec: agent/specs/meal-appointment-participation-frontend-implementation-spec.md

import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ParticipationAppBar } from '../features/participation/components/ParticipationAppBar.js';
import { ParticipantInfoCard } from '../features/participation/components/ParticipantInfoCard.js';
import { WeekNavigator } from '../features/participation/components/WeekNavigator.js';
import { SlotGrid } from '../features/participation/components/SlotGrid.js';
import { SummaryPanel } from '../features/participation/components/SummaryPanel.js';
import { ToastStack } from '../features/participation/components/ToastStack.js';
import { InlineStatus } from '../features/participation/components/InlineStatus.js';
import { participationStrings } from '../features/participation/strings.js';
import { buildSlotsForWeek } from '../features/participation/utils/slotKey.js';
import { useParticipationFlow } from '../features/participation/hooks/useParticipationFlow.js';

function HelpCard() {
  return (
    <div className="rounded-2xl border border-[var(--participation-border)] bg-white p-4" role="status">
      <h3 className="text-base font-semibold mb-2">{participationStrings.helpTitle}</h3>
      <p className="text-sm text-slate-700">{participationStrings.helpDescription}</p>
    </div>
  );
}

type Props = { apiBaseUrl: string };

const containerClass =
  'max-w-[1120px] mx-auto px-6 py-10 space-y-6 sm:px-4 bg-[var(--participation-neutral-100)]';

export function ParticipateAppointmentPage({ apiBaseUrl }: Props) {
  const { appointmentId = '' } = useParams();
  const [weekOffset, setWeekOffset] = useState(0);
  const flow = useParticipationFlow({ appointmentId, apiBaseUrl });

  const slots = useMemo(() => buildSlotsForWeek(flow.templateRules, weekOffset), [flow.templateRules, weekOffset]);
  const isReady = Boolean(flow.participantId);

  const renderBody = () => {
    if (flow.isLoading) {
      return <div className="rounded-2xl bg-white border border-[var(--participation-border)] p-6">{participationStrings.loading}</div>;
    }
    if (flow.queryError?.code === 'notFound') {
      return (
        <div className="rounded-2xl bg-white border border-[var(--participation-border)] p-8 text-center space-y-4" role="alert">
          <h2 className="text-xl font-semibold text-slate-900">{participationStrings.notFound}</h2>
          <button
            type="button"
            onClick={flow.refetch}
            className="rounded-xl bg-[var(--participation-secondary)] px-4 py-2 text-sm font-semibold text-white"
          >
            {participationStrings.retry}
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <ParticipantInfoCard
          nickname={flow.nickname}
          pin={flow.pin}
          onChangeNickname={flow.setNickname}
          onChangePin={flow.setPin}
          onTogglePersist={flow.setIsPersistedLocally}
          isPersistedLocally={flow.isPersistedLocally}
          statusBadge={
            flow.participantId
              ? {
                  variant: 'success',
                  label: participationStrings.existingResponse,
                  caption: flow.lastSubmittedAt ?? undefined
                }
              : flow.errorState && flow.errorState.code !== 'validation'
                ? { variant: 'error', label: flow.errorState.message }
                : null
          }
          onStart={flow.handleStart}
          isBusy={flow.isCreating}
          errorMessage={flow.errorState?.code === 'validation' ? flow.errorState.message : undefined}
        />

        <WeekNavigator weekOffset={weekOffset} onChange={setWeekOffset} />

        <div className="rounded-2xl border border-[var(--participation-border)] bg-white p-4 space-y-3">
          <p className="text-sm text-slate-700">{participationStrings.toggleInstruction}</p>
          {flow.errorState && flow.errorState.code !== 'validation' && (
            <InlineStatus
              variant={flow.errorState.code === 'invalidSlot' ? 'warning' : 'error'}
              message={flow.errorState.message}
            />
          )}
          <SlotGrid
            slots={slots}
            selectedSlots={flow.selectedSlots}
            onToggleSlot={flow.toggleSlot}
            allowSelection={isReady}
            summaryMap={flow.summaryMap}
            participantCount={flow.participantCount}
          />
        </div>

        <SummaryPanel
          selectedCount={flow.selectedSlots.length}
          totalSlots={slots.length}
          lastSubmittedAt={flow.lastSubmittedAt}
          onSubmit={flow.handleSubmitAvailability}
          onReset={flow.resetSelection}
          isSubmitting={flow.isSubmitting}
          overwriteWarning={Boolean(flow.lastSubmittedAt)}
        />
      </div>
    );
  };

  return (
    <div className={containerClass}>
      <ParticipationAppBar
        title={flow.summary?.participantCount ? `${participationStrings.pageTitle}` : participationStrings.pageTitle}
        isLoading={flow.isLoading}
      />
      <HelpCard />
      {renderBody()}
      <ToastStack toasts={flow.toasts} onDismiss={flow.dismissToast} />
    </div>
  );
}

export default ParticipateAppointmentPage;
