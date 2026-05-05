package domain

import "testing"

func TestSplitSlotKey(t *testing.T) {
	date, meal := SplitSlotKey("2024-05-04#DINNER")
	if date != "2024-05-04" || meal != "DINNER" {
		t.Fatalf("unexpected split: %q %q", date, meal)
	}
	d, m := SplitSlotKey("not-a-key")
	if d != "not-a-key" || m != "" {
		t.Fatalf("expected unsplit fallback, got %q %q", d, m)
	}
}

func TestCompareSlotKeys(t *testing.T) {
	cases := []struct {
		a, b string
		want int
	}{
		{"2024-05-04#BREAKFAST", "2024-05-04#LUNCH", -1},
		{"2024-05-04#DINNER", "2024-05-04#LUNCH", 1},
		{"2024-05-04#LUNCH", "2024-05-04#LUNCH", 0},
		{"2024-05-03#DINNER", "2024-05-04#BREAKFAST", -1},
	}
	for _, tc := range cases {
		got := CompareSlotKeys(tc.a, tc.b)
		if (got < 0) != (tc.want < 0) || (got > 0) != (tc.want > 0) || (got == 0) != (tc.want == 0) {
			t.Errorf("compare(%q,%q)=%d want sign %d", tc.a, tc.b, got, tc.want)
		}
	}
}
