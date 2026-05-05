// Implemented for spec: agent/specs/meal-appointment-participation-backend-implementation-spec.md

package domain

import "strings"

var mealOrder = map[string]int{
	"BREAKFAST": 0,
	"LUNCH":     1,
	"DINNER":    2,
}

func SplitSlotKey(slotKey string) (string, string) {
	idx := strings.Index(slotKey, "#")
	if idx < 0 {
		return slotKey, ""
	}
	return slotKey[:idx], slotKey[idx+1:]
}

func CompareSlotKeys(a, b string) int {
	dateA, mealA := SplitSlotKey(a)
	dateB, mealB := SplitSlotKey(b)

	if dateA != dateB {
		return strings.Compare(dateA, dateB)
	}

	rankA, okA := mealOrder[mealA]
	if !okA {
		rankA = 1<<31 - 1
	}
	rankB, okB := mealOrder[mealB]
	if !okB {
		rankB = 1<<31 - 1
	}
	if rankA != rankB {
		return rankA - rankB
	}
	return strings.Compare(mealA, mealB)
}
