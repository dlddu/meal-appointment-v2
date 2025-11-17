// Implemented for spec: agent/specs/meal-appointment-create-appointment-frontend-spec.md

import { useMutation } from '@tanstack/react-query';
import { useCallback, useMemo, useRef, useState } from 'react';
import type {
  CreateAppointmentPayload,
  CreateAppointmentResult,
  CreateAppointmentSuccess,
  CreateAppointmentError,
  ValidationErrorResponse,
  ServerErrorResponse,
  NetworkError
} from '../types.js';

async function postAppointment(apiBaseUrl: string, payload: CreateAppointmentPayload): Promise<CreateAppointmentSuccess> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    const networkError: NetworkError = {
      type: 'network',
      message: 'network-error'
    };
    throw networkError;
  }

  if (response.status === 400) {
    const data = await response.json();
    const fieldErrors = (data.errors ?? []).reduce(
      (
        acc: ValidationErrorResponse['fieldErrors'],
        issue: { field: string; message: string }
      ) => ({
        ...acc,
        [issue.field as keyof ValidationErrorResponse['fieldErrors']]: issue.message
      }),
      {}
    );
    const error: ValidationErrorResponse = {
      type: 'validation',
      status: 400,
      fieldErrors
    };
    throw error;
  }

  if (!response.ok) {
    let message = 'Unknown error';
    try {
      const data = await response.json();
      message = data.message ?? message;
    } catch (error) {
      // ignore json parse error
    }
    const error: ServerErrorResponse = {
      type: 'server',
      status: response.status,
      message
    };
    throw error;
  }

  return response.json();
}

export function useCreateAppointment(apiBaseUrl: string) {
  const [result, setResult] = useState<CreateAppointmentResult | null>(null);
  const lastPayloadRef = useRef<CreateAppointmentPayload | null>(null);

  const mutation = useMutation<CreateAppointmentSuccess, CreateAppointmentError, CreateAppointmentPayload>({
    mutationFn: async (payload) => {
      return postAppointment(apiBaseUrl, payload);
    },
    onSuccess: (response, payload) => {
      setResult({ payload, response });
    }
  });

  const submit = useCallback(
    (payload: CreateAppointmentPayload) => {
      lastPayloadRef.current = payload;
      mutation.mutate(payload);
    },
    [mutation]
  );

  const retry = useCallback(() => {
    if (lastPayloadRef.current) {
      mutation.mutate(lastPayloadRef.current);
    }
  }, [mutation]);

  const resetResult = useCallback(() => {
    setResult(null);
  }, []);

  const fieldErrors = useMemo(() => {
    if (mutation.error?.type === 'validation') {
      return mutation.error.fieldErrors;
    }
    return {};
  }, [mutation.error]);

  const bannerError = useMemo(() => {
    if (!mutation.error || mutation.error.type === 'validation') {
      return null;
    }
    return mutation.error;
  }, [mutation.error]);

  const clearError = useCallback(() => {
    mutation.reset();
  }, [mutation]);

  return {
    submit,
    retry,
    resetResult,
    clearError,
    fieldErrors,
    bannerError,
    result,
    isPending: mutation.isPending
  };
}
