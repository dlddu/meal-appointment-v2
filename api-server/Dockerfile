# Build stage
FROM golang:1.25-alpine AS builder

WORKDIR /src

# Cache module downloads.
COPY api-server/go.mod api-server/go.sum ./
RUN go mod download

# Copy the rest of the API server source.
COPY api-server/ ./

# Build all three binaries with CGO disabled (modernc.org/sqlite is pure Go).
ENV CGO_ENABLED=0
RUN go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server \
 && go build -trimpath -ldflags="-s -w" -o /out/migrate ./cmd/migrate \
 && go build -trimpath -ldflags="-s -w" -o /out/seed ./cmd/seed

# Runtime stage
FROM alpine:3.20 AS production

WORKDIR /app

RUN adduser -D -H -u 10001 app && mkdir -p /app/data && chown -R app:app /app

COPY --from=builder /out/server /app/server
COPY --from=builder /out/migrate /app/migrate
COPY --from=builder /out/seed /app/seed
COPY api-server/migrations /app/migrations

ENV PORT=4000 \
    DATABASE_URL=./data/meal_appointment.db \
    MIGRATION_FILE=/app/migrations/0001_init.sql

VOLUME /app/data
EXPOSE 4000
USER app

CMD ["/app/server"]
