// Tests for specs: agent/specs/meal-appointment-view-appointment-frontend-test-spec.md, agent/specs/meal-appointment-participation-frontend-test-spec.md

import { describe, expect, it } from 'vitest';
import { buildApiUrl } from './apiUrl.js';

describe('buildApiUrl', () => {
  it('keeps absolute API bases intact', () => {
    const result = buildApiUrl('https://api.example.com/v1', 'appointments/abc');
    expect(result.toString()).toBe('https://api.example.com/v1/appointments/abc');
  });

  it('resolves relative API bases against the current origin', () => {
    const result = buildApiUrl('/api', '/appointments/abc');
    expect(result.toString()).toBe(`${window.location.origin}/api/appointments/abc`);
  });
});
