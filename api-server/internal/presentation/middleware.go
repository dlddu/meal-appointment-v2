package presentation

import (
	"context"
	"net/http"
)

func RequestIDMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get("X-Request-Id")
		if id == "" {
			id = r.Header.Get("Request-Id")
		}
		if id != "" {
			w.Header().Set("X-Request-Id", id)
			ctx := context.WithValue(r.Context(), requestIDContextKey, id)
			r = r.WithContext(ctx)
		}
		next.ServeHTTP(w, r)
	})
}

func CORSMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-Id, Request-Id")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func RequestIDFromContext(ctx context.Context) string {
	if v, ok := ctx.Value(requestIDContextKey).(string); ok {
		return v
	}
	return ""
}
