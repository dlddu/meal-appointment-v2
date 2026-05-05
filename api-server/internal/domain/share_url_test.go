package domain

import "testing"

func TestShareURLBuilder(t *testing.T) {
	b := NewShareURLBuilder()
	if got := b.BuildRelativePath("abc-123"); got != "/appointments/abc-123" {
		t.Errorf("unexpected share path: %s", got)
	}
}
