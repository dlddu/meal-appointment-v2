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

func NewAvailabilityAggregator() *AvailabilityAggregator {
	return &AvailabilityAggregator{}
}

func (a *AvailabilityAggregator) Aggregate(selections []AvailabilitySelection) AvailabilityAggregationResult {
	counts := make(map[string]int, len(selections))
	for _, s := range selections {
		counts[s.SlotKey]++
	}
	return AvailabilityAggregationResult{
		AvailableCountBySlotKey: counts,
		TotalSelections:         len(selections),
	}
}
