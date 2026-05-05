# Build stage
FROM golang:1.24-alpine AS builder

WORKDIR /src

COPY api-server/go.mod api-server/go.sum ./
RUN go mod download

COPY api-server/ ./

RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server \
    && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/migrate ./cmd/migrate \
    && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/seed ./cmd/seed

# Production stage
FROM alpine:3.20

WORKDIR /app

RUN adduser -D -H app && mkdir -p /app/data && chown -R app:app /app

COPY --from=builder /out/server /app/server
COPY --from=builder /out/migrate /app/migrate
COPY --from=builder /out/seed /app/seed
COPY --from=builder /src/migrations /app/migrations

USER app

VOLUME /app/data
EXPOSE 4000

CMD ["/app/server"]
