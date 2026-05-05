// Implemented for spec: agent/specs/meal-appointment-view-appointment-backend-implementation-spec.md

package domain

type AvailabilitySelection struct {
	ParticipantID string
	SlotKey       string
}

type AvailabilityAggregationResult struct {
	AvailableCountBySlotKey map[string]int
	TotalSelections         int
}

type AvailabilityAggregator struct{}

func NewAvailabilityAggregator() *AvailabilityAggregator { return &AvailabilityAggregator{} }

func (AvailabilityAggregator) Aggregate(selections []AvailabilitySelection) AvailabilityAggregationResult {
	counts := make(map[string]int, len(selections))
	for _, s := range selections {
		counts[s.SlotKey]++
	}
	return AvailabilityAggregationResult{
		AvailableCountBySlotKey: counts,
		TotalSelections:         len(selections),
	}
}
