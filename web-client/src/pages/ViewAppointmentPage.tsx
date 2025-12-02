// Implemented for spec: agent/specs/meal-appointment-view-appointment-frontend-spec.md

import { useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppointmentOverviewCard } from '../features/view-appointment/components/AppointmentOverviewCard.js';
import { SlotSummaryGrid } from '../features/view-appointment/components/SlotSummaryGrid.js';
import { ParticipantTabs } from '../features/view-appointment/components/ParticipantTabs.js';
import { StatusMessage } from '../features/view-appointment/components/StatusMessage.js';
import { ParticipationGuideCard } from '../features/view-appointment/components/ParticipationGuideCard.js';
import { useAppointmentQuery } from '../features/view-appointment/hooks/useAppointmentQuery.js';
import { viewAppointmentStrings } from '../features/view-appointment/strings.js';
import type { AppointmentViewResponse } from '../features/view-appointment/api/getAppointment.js';
import type { SlotGroup } from '../features/view-appointment/utils/groupSlotSummaries.js';
import type { ParticipantMatrixEntry } from '../features/view-appointment/utils/buildParticipantMatrix.js';

const containerClass =
  'max-w-[1120px] mx-auto px-6 py-10 space-y-8 sm:px-6 lg:px-8 bg-[var(--color-view-neutral)]';

export function ViewAppointmentPage({ apiBaseUrl }: { apiBaseUrl: string }) {
  const { appointmentId = '' } = useParams();
  const navigate = useNavigate();
  const [toast, setToast] = useState<string | null>(null);

  const query = useAppointmentQuery({ appointmentId, apiBaseUrl });

  const handleRetry = useCallback(() => {
    query.refetch({ cancelRefetch: false });
  }, [query]);

  const handleShare = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setToast(viewAppointmentStrings.copySuccess);
      setTimeout(() => setToast(null), 3000);
    } catch (error) {
      setToast(viewAppointmentStrings.copyFailure);
    }
  }, []);

  const handleNavigateRespond = useCallback(() => {
    if (!appointmentId) return;
    navigate(`/appointments/${appointmentId}/participate`);
  }, [appointmentId, navigate]);

  const renderContent = () => {
    if (query.isLoading) {
      return (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-[var(--color-view-border)] p-6">
            <StatusMessage variant="loading" />
          </div>
        </div>
      );
    }

    if (query.errorState) {
      if (query.errorState.code === 'notFound') {
        return (
          <div className="bg-white rounded-2xl border border-[var(--color-view-border)] p-8 text-center space-y-4">
            <h2 className="text-xl font-semibold text-slate-900">{viewAppointmentStrings.notFound}</h2>
            <button
              type="button"
              onClick={handleRetry}
              className="rounded-xl bg-[var(--color-view-primary)] px-4 py-2 text-sm font-semibold text-white"
            >
              {viewAppointmentStrings.retry}
            </button>
          </div>
        );
      }

      return <StatusMessage variant="error" label={query.errorState.message} onRetry={handleRetry} />;
    }

    if (!query.data) return null;

    return (
      <>
        <ParticipationGuideCard
          appointmentTitle={query.data.appointment.title}
          onNavigateToRespond={handleNavigateRespond}
          onShare={handleShare}
        />
        <AppointmentContent
          data={query.data}
          slotGroups={query.slotGroups}
          participantMatrix={query.participantMatrix}
          onRetry={handleRetry}
        />
      </>
    );
  };

  return (
    <div className={containerClass}>
      {toast && (
        <div className="rounded-xl bg-[var(--color-view-secondary)] px-4 py-3 text-sm font-semibold text-white" role="status" aria-live="polite">
          {toast}
        </div>
      )}
      {renderContent()}
    </div>
  );
}

type AppointmentContentProps = {
  data: AppointmentViewResponse;
  slotGroups: SlotGroup[];
  participantMatrix: ParticipantMatrixEntry[];
  onRetry: () => void;
};

function AppointmentContent({ data, slotGroups, participantMatrix, onRetry }: AppointmentContentProps) {
  return (
    <div className="space-y-6">
      <AppointmentOverviewCard appointment={data.appointment} template={data.template} />
      <SlotSummaryGrid
        slotGroups={slotGroups}
        participantCount={data.aggregates.participantCount}
        onRetry={onRetry}
      />
      <ParticipantTabs participants={data.participants} participantMatrix={participantMatrix} />
    </div>
  );
}
