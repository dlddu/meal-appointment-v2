// Implemented for spec: agent/specs/meal-appointment-participation-frontend-implementation-spec.md

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  getAppointmentTemplate,
  type ParticipationApiError,
  type ParticipationTemplateResponse,
  type ParticipationSlotSummary
} from '../api/getAppointmentTemplate.js';
import {
  createParticipant,
  type CreateParticipantRequest,
  type CreateParticipantResponse
} from '../api/createParticipant.js';
import {
  submitAvailability,
  type SubmitAvailabilityRequest,
  type SubmitAvailabilityResponse
} from '../api/submitAvailability.js';
import { participationStrings } from '../strings.js';
import { loadCredentials, saveCredentials, clearCredentials } from '../utils/storage.js';
import type { TemplateRule } from '../utils/slotKey.js';

export type ParticipationErrorCode =
  | 'notFound'
  | 'nicknameTaken'
  | 'invalidPin'
  | 'invalidSlot'
  | 'temporaryFailure'
  | 'network'
  | 'validation';

export type ParticipationError = {
  code: ParticipationErrorCode;
  message: string;
};

type Toast = { id: string; message: string; variant: 'success' | 'error' | 'warning' };

type Params = {
  appointmentId: string;
  apiBaseUrl: string;
  initialNickname?: string;
  initialPin?: string;
};

function mapError(error: ParticipationApiError): ParticipationError {
  if (error.code === 'NETWORK_ERROR') {
    return { code: 'network', message: participationStrings.networkError };
  }
  if (error.code === 'APPOINTMENT_NOT_FOUND' || error.status === 404) {
    return { code: 'notFound', message: participationStrings.notFound };
  }
  if (error.code === 'NICKNAME_TAKEN' || error.status === 409) {
    return { code: 'nicknameTaken', message: participationStrings.nicknameTaken };
  }
  if (error.code === 'INVALID_PIN' || error.status === 403) {
    return { code: 'invalidPin', message: participationStrings.invalidPin };
  }
  if (error.code === 'INVALID_SLOT') {
    return { code: 'invalidSlot', message: participationStrings.invalidSlot };
  }
  if (error.status === 503 || error.status === 500) {
    return { code: 'temporaryFailure', message: participationStrings.temporaryFailure };
  }
  return { code: 'validation', message: error.message };
}

export function useParticipationFlow({ appointmentId, apiBaseUrl, initialNickname, initialPin }: Params) {
  const stored = loadCredentials();
  const [nickname, setNickname] = useState(stored?.nickname ?? initialNickname ?? '');
  const [pin, setPin] = useState(stored?.pin ?? initialPin ?? '');
  const [isPersistedLocally, setIsPersistedLocally] = useState(Boolean(stored));
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [hasPin, setHasPin] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [lastSubmittedAt, setLastSubmittedAt] = useState<string | null>(null);
  const [errorState, setErrorState] = useState<ParticipationError | null>(null);
  const [summary, setSummary] = useState<{ participantCount: number; slotSummaries: ParticipationSlotSummary[] } | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const query = useQuery<ParticipationTemplateResponse, ParticipationApiError>({
    queryKey: ['appointment', appointmentId, 'participation'],
    queryFn: () => getAppointmentTemplate(appointmentId, apiBaseUrl),
    retry: 1,
    staleTime: 30_000
  });

  useEffect(() => {
    if (query.data?.aggregates) {
      setSummary(query.data.aggregates);
    }
  }, [query.data]);

  useEffect(() => {
    if (!isPersistedLocally) {
      clearCredentials();
      return;
    }
    if (nickname.trim()) {
      saveCredentials({ nickname: nickname.trim(), pin: pin || undefined, appointmentId });
    }
  }, [appointmentId, isPersistedLocally, nickname, pin]);

  const createMutation = useMutation<CreateParticipantResponse, ParticipationApiError, CreateParticipantRequest>({
    mutationFn: (payload) => createParticipant(appointmentId, payload, apiBaseUrl),
    onSuccess: (data) => {
      setParticipantId(data.participantId);
      setHasPin(data.hasPin);
      setSelectedSlots(Array.from(new Set(data.responses)));
      setLastSubmittedAt(data.submittedAt);
      setErrorState(null);
      if (isPersistedLocally) {
        saveCredentials({ nickname: data.nickname, appointmentId, pin: pin || undefined });
      }
      setToasts((prev) => [...prev, { id: `${Date.now()}-join`, message: participationStrings.existingResponse, variant: 'success' }]);
    },
    onError: (error) => {
      setErrorState(mapError(error));
    }
  });

  const submitMutation = useMutation<SubmitAvailabilityResponse, ParticipationApiError, SubmitAvailabilityRequest>({
    mutationFn: (payload) => {
      if (!participantId) {
        const err: ParticipationApiError = new Error('참여자 정보를 먼저 등록해 주세요');
        err.code = 'VALIDATION_ERROR';
        throw err;
      }
      return submitAvailability(appointmentId, participantId, payload, apiBaseUrl);
    },
    onSuccess: (data) => {
      setSelectedSlots(Array.from(new Set(data.selected)));
      setLastSubmittedAt(data.submittedAt);
      setSummary({ participantCount: data.summary.participantCount, slotSummaries: data.summary.slotSummaries });
      setToasts((prev) => [...prev, { id: `${Date.now()}-submit`, message: participationStrings.submitSuccess, variant: 'success' }]);
      setErrorState(null);
    },
    onError: (error) => {
      setErrorState(mapError(error));
    }
  });

  const templateRules: TemplateRule[] = query.data?.template.rules ?? [];

  const summaryMap = useMemo(() => {
    const map: Record<string, ParticipationSlotSummary> = {};
    (summary?.slotSummaries ?? []).forEach((item) => {
      map[item.slotKey] = item;
    });
    return map;
  }, [summary]);

  const participantCount = summary?.participantCount ?? 0;

  const toggleSlot = useCallback(
    (slotKey: string) => {
      setSelectedSlots((prev) => {
        if (prev.includes(slotKey)) return prev.filter((s) => s !== slotKey);
        return [...prev, slotKey];
      });
    },
    [setSelectedSlots]
  );

  const resetSelection = useCallback(() => {
    setSelectedSlots([]);
  }, []);

  const handleStart = useCallback(() => {
    const trimmed = nickname.trim();
    if (!trimmed || trimmed.length > 30) {
      setErrorState({ code: 'validation', message: participationStrings.nicknameLabel });
      return;
    }
    if (pin && (pin.length < 4 || pin.length > 12)) {
      setErrorState({ code: 'validation', message: participationStrings.invalidPin });
      return;
    }
    createMutation.mutate({ nickname: trimmed, pin: pin || undefined });
  }, [createMutation, nickname, pin]);

  const handleSubmitAvailability = useCallback(() => {
    const trimmed = nickname.trim();
    if (!trimmed) {
      setErrorState({ code: 'validation', message: participationStrings.nicknameLabel });
      return;
    }
    submitMutation.mutate({ nickname: trimmed, pin: pin || undefined, availableSlots: selectedSlots });
  }, [nickname, pin, selectedSlots, submitMutation, participantId]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const toastTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    toasts.forEach((toast) => {
      if (!toastTimers.current.has(toast.id)) {
        const timer = setTimeout(() => {
          dismissToast(toast.id);
          toastTimers.current.delete(toast.id);
        }, 3000);
        toastTimers.current.set(toast.id, timer);
      }
    });

    // Clean up timers for toasts that were manually dismissed
    const currentIds = new Set(toasts.map((t) => t.id));
    toastTimers.current.forEach((timer, id) => {
      if (!currentIds.has(id)) {
        clearTimeout(timer);
        toastTimers.current.delete(id);
      }
    });
  }, [toasts, dismissToast]);

  const refetch = useCallback(() => {
    query.refetch({ cancelRefetch: false });
  }, [query]);

  return {
    nickname,
    pin,
    setNickname,
    setPin,
    isPersistedLocally,
    setIsPersistedLocally,
    participantId,
    hasPin,
    selectedSlots,
    toggleSlot,
    resetSelection,
    lastSubmittedAt,
    summary,
    summaryMap,
    participantCount,
    templateRules,
    errorState,
    clearError: () => setErrorState(null),
    handleStart,
    handleSubmitAvailability,
    isLoading: query.isLoading,
    isError: query.isError,
    queryError: query.error ? mapError(query.error) : null,
    refetch,
    toasts,
    dismissToast,
    isCreating: createMutation.isLoading,
    isSubmitting: submitMutation.isLoading
  };
}
