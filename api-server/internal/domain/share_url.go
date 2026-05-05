// Implemented for spec: agent/specs/meal-appointment-create-appointment-backend-spec.md

package domain

type ShareURLBuilder struct{}

func NewShareURLBuilder() *ShareURLBuilder { return &ShareURLBuilder{} }

func (ShareURLBuilder) BuildRelativePath(appointmentID string) string {
	return "/appointments/" + appointmentID
}
