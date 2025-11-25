// Tests for spec: agent/specs/meal-appointment-participation-frontend-test-spec.md

import { describe, expect, it } from 'vitest';
import { participationStrings } from '../strings.js';

describe('participationStrings', () => {
  it('exposes required copy keys', () => {
    expect(participationStrings.startParticipation).toBe('참여 시작');
    expect(participationStrings.submitAvailability).toBe('가용 시간 제출');
    expect(participationStrings.invalidPin).toContain('PIN');
  });

  it('renders dynamic helper labels', () => {
    expect(participationStrings.selectedCount(3)).toBe('선택됨 3개');
    expect(participationStrings.slotAvailableCount(2, 5)).toBe('2/5');
  });
});
