// Implemented for spec: agent/specs/meal-appointment-create-appointment-backend-spec.md

package logger

import (
	"os"
	"strings"
	"time"

	"github.com/rs/zerolog"
)

// New constructs a zerolog logger that emits the JSON shape expected by the
// existing operational tooling (level, time, msg fields).
func New() zerolog.Logger {
	level := strings.ToLower(os.Getenv("LOG_LEVEL"))
	parsed, err := zerolog.ParseLevel(level)
	if err != nil || parsed == zerolog.NoLevel {
		parsed = zerolog.InfoLevel
	}
	zerolog.TimeFieldFormat = time.RFC3339Nano
	return zerolog.New(os.Stdout).Level(parsed).With().Timestamp().Logger()
}
