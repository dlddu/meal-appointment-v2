// Implemented for spec: agent/specs/meal-appointment-create-appointment-frontend-test-spec.md

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { afterEach } from 'vitest';

const activeClients: QueryClient[] = [];

export function createTestQueryClient() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
  activeClients.push(client);
  return client;
}

export function renderWithQueryClient(
  ui: ReactElement,
  options: RenderOptions & { queryClient?: QueryClient } = {}
) {
  const { queryClient: providedClient, ...renderOptions } = options;
  const queryClient = providedClient ?? createTestQueryClient();
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}

afterEach(() => {
  activeClients.forEach((client) => client.clear());
  activeClients.length = 0;
});
