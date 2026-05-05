package domain

import "testing"

func TestAvailabilityAggregator(t *testing.T) {
	agg := AvailabilityAggregator{}
	res := agg.Aggregate([]AvailabilitySelection{
		{ParticipantID: "p1", SlotKey: "2024-05-04#LUNCH"},
		{ParticipantID: "p2", SlotKey: "2024-05-04#LUNCH"},
		{ParticipantID: "p1", SlotKey: "2024-05-05#DINNER"},
	})
	if res.TotalSelections != 3 {
		t.Errorf("total: want 3 got %d", res.TotalSelections)
	}
	if res.AvailableCountBySlotKey["2024-05-04#LUNCH"] != 2 {
		t.Errorf("lunch count: want 2 got %d", res.AvailableCountBySlotKey["2024-05-04#LUNCH"])
	}
	if res.AvailableCountBySlotKey["2024-05-05#DINNER"] != 1 {
		t.Errorf("dinner count: want 1 got %d", res.AvailableCountBySlotKey["2024-05-05#DINNER"])
	}
}
