package metrics

import (
	"strconv"

	"github.com/prometheus/client_golang/prometheus"
)

type AppointmentMetrics interface {
	IncrementAppointmentsCreated(templateID string)
	RecordHTTPRequest(route string, statusCode int)
	ObserveAppointmentViewDuration(durationMs float64, cacheHit bool)
	UpdateTemplateCacheHitRatio(ratio float64)
	ObserveParticipantJoin(durationMs float64)
	ObserveResponseSubmission(durationMs float64, slotCount int)
	Registry() *prometheus.Registry
}

type Prometheus struct {
	registry                  *prometheus.Registry
	appointmentsCreated       *prometheus.CounterVec
	httpRequestsTotal         *prometheus.CounterVec
	viewDuration              *prometheus.HistogramVec
	templateCacheHitRatio     prometheus.Gauge
	participantJoinDuration   prometheus.Histogram
	responseSubmissionDuration prometheus.Histogram
	responseSlotCount         prometheus.Histogram
}

func NewPrometheus() *Prometheus {
	registry := prometheus.NewRegistry()

	m := &Prometheus{
		registry: registry,
		appointmentsCreated: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "appointments_created_total",
			Help: "Number of appointments created",
		}, []string{"time_slot_template_id"}),
		httpRequestsTotal: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "http_server_requests_total",
			Help: "Total HTTP requests processed",
		}, []string{"route", "status_code"}),
		viewDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Name:    "appointment_view_duration_ms",
			Help:    "Duration of appointment view requests in milliseconds",
			Buckets: []float64{10, 50, 100, 250, 500, 1000, 2000},
		}, []string{"cache_hit"}),
		templateCacheHitRatio: prometheus.NewGauge(prometheus.GaugeOpts{
			Name: "template_cache_hit_ratio",
			Help: "Ratio of template cache hits over total lookups",
		}),
		participantJoinDuration: prometheus.NewHistogram(prometheus.HistogramOpts{
			Name:    "participant_join_duration_ms",
			Help:    "Duration of participant join requests in milliseconds",
			Buckets: []float64{10, 50, 100, 250, 500, 1000, 2000},
		}),
		responseSubmissionDuration: prometheus.NewHistogram(prometheus.HistogramOpts{
			Name:    "participant_response_submission_ms",
			Help:    "Duration of response submission requests in milliseconds",
			Buckets: []float64{10, 50, 100, 250, 500, 1000, 2000},
		}),
		responseSlotCount: prometheus.NewHistogram(prometheus.HistogramOpts{
			Name:    "participant_response_slot_count",
			Help:    "Number of slots submitted per participant response",
			Buckets: []float64{0, 1, 2, 3, 5, 8, 13, 21},
		}),
	}

	registry.MustRegister(
		m.appointmentsCreated,
		m.httpRequestsTotal,
		m.viewDuration,
		m.templateCacheHitRatio,
		m.participantJoinDuration,
		m.responseSubmissionDuration,
		m.responseSlotCount,
	)
	return m
}

func (m *Prometheus) IncrementAppointmentsCreated(templateID string) {
	m.appointmentsCreated.WithLabelValues(templateID).Inc()
}

func (m *Prometheus) RecordHTTPRequest(route string, statusCode int) {
	m.httpRequestsTotal.WithLabelValues(route, strconv.Itoa(statusCode)).Inc()
}

func (m *Prometheus) ObserveAppointmentViewDuration(durationMs float64, cacheHit bool) {
	label := "false"
	if cacheHit {
		label = "true"
	}
	m.viewDuration.WithLabelValues(label).Observe(durationMs)
}

func (m *Prometheus) UpdateTemplateCacheHitRatio(ratio float64) {
	m.templateCacheHitRatio.Set(ratio)
}

func (m *Prometheus) ObserveParticipantJoin(durationMs float64) {
	m.participantJoinDuration.Observe(durationMs)
}

func (m *Prometheus) ObserveResponseSubmission(durationMs float64, slotCount int) {
	m.responseSubmissionDuration.Observe(durationMs)
	m.responseSlotCount.Observe(float64(slotCount))
}

func (m *Prometheus) Registry() *prometheus.Registry {
	return m.registry
}
