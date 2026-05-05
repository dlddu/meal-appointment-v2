// Implemented for spec: agent/specs/meal-appointment-create-appointment-backend-spec.md

package presentation

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/rs/zerolog"

	"github.com/dlddu/meal-appointment-v2/api-server/internal/application"
)

type ctxKey int

const (
	ctxKeyRequestID ctxKey = iota
)

// WithRequestID stores the request id in the context.
func WithRequestID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, ctxKeyRequestID, id)
}

// RequestIDFrom returns the request id stored in ctx, if any.
func RequestIDFrom(ctx context.Context) string {
	if v, ok := ctx.Value(ctxKeyRequestID).(string); ok {
		return v
	}
	return ""
}

// RequestIDMiddleware mirrors the Express middleware: it copies x-request-id
// (or request-id) from the request onto the response header and the context.
func RequestIDMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestID := r.Header.Get("x-request-id")
		if requestID == "" {
			requestID = r.Header.Get("request-id")
		}
		if requestID != "" {
			w.Header().Set("x-request-id", requestID)
			r = r.WithContext(WithRequestID(r.Context(), requestID))
		}
		next.ServeHTTP(w, r)
	})
}

// CORSMiddleware applies the same permissive CORS as the Express cors() default.
func CORSMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,PATCH,OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-request-id, request-id")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// WriteJSON serialises payload as JSON and writes the response.
func WriteJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if payload == nil {
		return
	}
	_ = json.NewEncoder(w).Encode(payload)
}

// WriteAppError formats an *application.AppError into the flat error envelope
// used by the Express middleware.
func WriteAppError(w http.ResponseWriter, r *http.Request, logger zerolog.Logger, err error) {
	requestID := RequestIDFrom(r.Context())

	var appErr *application.AppError
	if errors.As(err, &appErr) {
		body := map[string]any{
			"code":      appErr.Code,
			"message":   appErr.Message,
			"requestId": requestID,
		}
		if len(appErr.Errors) > 0 {
			body["errors"] = appErr.Errors
		}
		logger.Error().
			Str("requestId", requestID).
			Str("code", appErr.Code).
			Err(appErr).
			Send()
		WriteJSON(w, appErr.StatusCode, body)
		return
	}

	logger.Error().
		Str("requestId", requestID).
		Err(err).
		Msg("Unhandled error")
	WriteJSON(w, http.StatusInternalServerError, map[string]any{
		"code":      "INTERNAL_SERVER_ERROR",
		"message":   "Internal server error",
		"requestId": requestID,
	})
}
