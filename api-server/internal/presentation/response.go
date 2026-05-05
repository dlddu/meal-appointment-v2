package presentation

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/dlddu/meal-appointment-v2/api-server/internal/application"
)

const requestIDContextKey ctxKey = "requestId"

type ctxKey string

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if body == nil {
		return
	}
	_ = json.NewEncoder(w).Encode(body)
}

func writeError(w http.ResponseWriter, r *http.Request, log *slog.Logger, err error) {
	requestID := RequestIDFromContext(r.Context())
	var appErr *application.Error
	if errors.As(err, &appErr) {
		log.Error("Application error",
			slog.String("requestId", requestID),
			slog.String("code", appErr.Code),
			slog.Any("err", err))
		body := map[string]any{
			"code":      appErr.Code,
			"message":   appErr.Message,
			"requestId": requestID,
		}
		if len(appErr.FieldErrors) > 0 {
			body["errors"] = appErr.FieldErrors
		}
		writeJSON(w, appErr.StatusCode, body)
		return
	}

	log.Error("Unhandled error",
		slog.String("requestId", requestID),
		slog.Any("err", err))
	writeJSON(w, http.StatusInternalServerError, map[string]any{
		"code":      "INTERNAL_SERVER_ERROR",
		"message":   "Internal server error",
		"requestId": requestID,
	})
}
