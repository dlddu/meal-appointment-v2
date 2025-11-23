// Implemented for spec: agent/specs/meal-appointment-view-appointment-frontend-spec.md

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAppointment, type AppointmentApiError } from '../api/getAppointment.js';
import { groupSlotSummaries, type SlotGroup } from '../utils/groupSlotSummaries.js';
import { buildParticipantMatrix, type ParticipantMatrixEntry } from '../utils/buildParticipantMatrix.js';
import type { AppointmentViewResponse } from '../api/getAppointment.js';

type ErrorCode = 'notFound' | 'temporaryFailure' | 'network' | 'unknown';

export type ErrorBoundaryState = {
  code: ErrorCode;
  message: string;
};

function mapError(error: AppointmentApiError): ErrorBoundaryState {
  if (error.code === 'NETWORK_ERROR') {
    return { code: 'network', message: '네트워크 오류가 발생했습니다' };
  }

  if (error.code === 'APPOINTMENT_NOT_FOUND' || error.status === 404) {
    return { code: 'notFound', message: '약속을 찾을 수 없습니다' };
  }

  if (error.status === 503 || error.status === 500) {
    return { code: 'temporaryFailure', message: '일시적인 문제로 약속 정보를 불러오지 못했습니다.' };
  }

  return { code: 'unknown', message: error.message };
}

export function useAppointmentQuery(params: { appointmentId: string; apiBaseUrl: string }) {
  const { appointmentId, apiBaseUrl } = params;

  const query = useQuery<AppointmentViewResponse, AppointmentApiError>({
    queryKey: ['appointment', appointmentId],
    queryFn: () => getAppointment(appointmentId, apiBaseUrl),
    retry: 1,
    staleTime: 30_000
  });

  const slotGroups: SlotGroup[] = useMemo(() => {
    if (!query.data) return [];
    return groupSlotSummaries(query.data.aggregates.slotSummaries);
  }, [query.data]);

  const participantMatrix: ParticipantMatrixEntry[] = useMemo(() => {
    if (!query.data) return [];
    return buildParticipantMatrix(query.data.participants, query.data.aggregates.slotSummaries);
  }, [query.data]);

  const errorState: ErrorBoundaryState | null = useMemo(() => {
    if (!query.error) return null;
    return mapError(query.error);
  }, [query.error]);

  return {
    ...query,
    slotGroups,
    participantMatrix,
    errorState
  };
}
