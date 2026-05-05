package participants

import (
	"testing"

	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/repos"
)

func TestSlotValidationHelper(t *testing.T) {
	helper := NewSlotValidationHelper([]repos.TemplateRule{
		{DayPattern: "WEEKDAY", MealTypes: []string{"DINNER"}},
		{DayPattern: "WEEKEND", MealTypes: []string{"LUNCH", "DINNER"}},
		{DayPattern: "2024-05-15", MealTypes: []string{"BREAKFAST"}},
	})

	cases := []struct {
		key  string
		want bool
	}{
		{"2024-05-13#DINNER", true},   // Monday
		{"2024-05-13#LUNCH", false},   // Monday lunch not allowed
		{"2024-05-11#LUNCH", true},    // Saturday weekend lunch
		{"2024-05-11#DINNER", true},   // Saturday weekend dinner
		{"2024-05-15#BREAKFAST", true}, // Specific date breakfast
		{"2024-05-16#BREAKFAST", false},
		{"not-a-key", false},
		{"2024-13-40#DINNER", false},
	}
	for _, tc := range cases {
		if got := helper.IsValid(tc.key); got != tc.want {
			t.Errorf("IsValid(%q)=%v want %v", tc.key, got, tc.want)
		}
	}
}
