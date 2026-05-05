// Implemented for spec: agent/specs/meal-appointment-create-appointment-backend-spec.md

package domain

type SlotRule struct {
	SlotInstanceID string `json:"slotInstanceId"`
	Label          string `json:"label"`
}

type TemplateDefinition struct {
	ID    string     `json:"id"`
	Name  string     `json:"name"`
	Rules []SlotRule `json:"rules"`
}

func (t TemplateDefinition) GenerateSlots() []SlotRule {
	out := make([]SlotRule, len(t.Rules))
	copy(out, t.Rules)
	return out
}

var DemoTemplate = TemplateDefinition{
	ID:   "demo-default",
	Name: "Demo Template",
	Rules: []SlotRule{
		{SlotInstanceID: "2024-05-01_dinner", Label: "May 1st – Dinner"},
		{SlotInstanceID: "2024-05-02_lunch", Label: "May 2nd – Lunch"},
	},
}
