package domain

import (
	"math"
	"strings"
)

var mealOrder = map[string]int{
	"BREAKFAST": 0,
	"LUNCH":     1,
	"DINNER":    2,
}

func SplitSlotKey(slotKey string) (string, string) {
	parts := strings.SplitN(slotKey, "#", 2)
	if len(parts) < 2 {
		date := ""
		if len(parts) == 1 {
			date = parts[0]
		}
		return date, ""
	}
	return parts[0], parts[1]
}

func CompareSlotKeys(a, b string) int {
	dateA, mealA := SplitSlotKey(a)
	dateB, mealB := SplitSlotKey(b)
	if dateA != dateB {
		return strings.Compare(dateA, dateB)
	}
	rankA, ok := mealOrder[mealA]
	if !ok {
		rankA = math.MaxInt32
	}
	rankB, ok := mealOrder[mealB]
	if !ok {
		rankB = math.MaxInt32
	}
	if rankA != rankB {
		return rankA - rankB
	}
	return strings.Compare(mealA, mealB)
}
