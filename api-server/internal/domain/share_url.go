package domain

import "fmt"

type ShareURLBuilder struct{}

func NewShareURLBuilder() *ShareURLBuilder {
	return &ShareURLBuilder{}
}

func (b *ShareURLBuilder) BuildRelativePath(appointmentID string) string {
	return fmt.Sprintf("/appointments/%s", appointmentID)
}
