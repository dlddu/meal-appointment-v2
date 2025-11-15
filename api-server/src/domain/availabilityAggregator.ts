// Implemented for spec: agent/specs/meal-appointment-view-appointment-backend-implementation-spec.md

export interface AvailabilitySelection {
  participantId: string;
  slotKey: string;
}

export interface AvailabilityAggregationResult {
  availableCountBySlotKey: Map<string, number>;
  totalSelections: number;
}

export class AvailabilityAggregator {
  aggregate(selections: AvailabilitySelection[]): AvailabilityAggregationResult {
    const availableCountBySlotKey = new Map<string, number>();
    for (const selection of selections) {
      const current = availableCountBySlotKey.get(selection.slotKey) ?? 0;
      availableCountBySlotKey.set(selection.slotKey, current + 1);
    }

    return {
      availableCountBySlotKey,
      totalSelections: selections.length
    };
  }
}
