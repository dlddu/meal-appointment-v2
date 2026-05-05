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

func DemoTemplate() TemplateDefinition {
	return TemplateDefinition{
		ID:   "demo-default",
		Name: "Demo Template",
		Rules: []SlotRule{
			{SlotInstanceID: "2024-05-01_dinner", Label: "May 1st – Dinner"},
			{SlotInstanceID: "2024-05-02_lunch", Label: "May 2nd – Lunch"},
		},
	}
}
