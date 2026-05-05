// Implemented for spec: agent/specs/meal-appointment-create-appointment-backend-spec.md
// Implemented for spec: agent/specs/meal-appointment-view-appointment-backend-implementation-spec.md

package metrics

import (
	"strconv"

	"github.com/prometheus/client_golang/prometheus"
)

// AppointmentMetrics is the surface used by the application services.
type AppointmentMetrics interface {
	IncrementAppointmentsCreated(templateID string)
	RecordHTTPRequest(route string, statusCode int)
	ObserveAppointmentViewDuration(durationMs float64, cacheHit bool)
	UpdateTemplateCacheHitRatio(ratio float64)
	ObserveParticipantJoin(durationMs float64)
	ObserveResponseSubmission(durationMs float64, slotCount int)
	Registry() *prometheus.Registry
	Reset()
}

type Prometheus struct {
	registry                    *prometheus.Registry
	appointmentsCreated         *prometheus.CounterVec
	httpRequests                *prometheus.CounterVec
	viewDuration                *prometheus.HistogramVec
	templateCacheHitRatio       prometheus.Gauge
	participantJoinDuration     prometheus.Histogram
	responseSubmissionDuration  prometheus.Histogram
	responseSubmissionSlotCount prometheus.Histogram
}

func NewPrometheus() *Prometheus {
	registry := prometheus.NewRegistry()

	created := prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "appointments_created_total",
		Help: "Number of appointments created",
	}, []string{"time_slot_template_id"})

	httpReq := prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "http_server_requests_total",
		Help: "Total HTTP requests processed",
	}, []string{"route", "status_code"})

	viewDuration := prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "appointment_view_duration_ms",
		Help:    "Duration of appointment view requests in milliseconds",
		Buckets: []float64{10, 50, 100, 250, 500, 1000, 2000},
	}, []string{"cache_hit"})

	cacheRatio := prometheus.NewGauge(prometheus.GaugeOpts{
		Name: "template_cache_hit_ratio",
		Help: "Ratio of template cache hits over total lookups",
	})

	participantJoin := prometheus.NewHistogram(prometheus.HistogramOpts{
		Name:    "participant_join_duration_ms",
		Help:    "Duration of participant join requests in milliseconds",
		Buckets: []float64{10, 50, 100, 250, 500, 1000, 2000},
	})

	responseSubmission := prometheus.NewHistogram(prometheus.HistogramOpts{
		Name:    "participant_response_submission_ms",
		Help:    "Duration of response submission requests in milliseconds",
		Buckets: []float64{10, 50, 100, 250, 500, 1000, 2000},
	})

	responseSlots := prometheus.NewHistogram(prometheus.HistogramOpts{
		Name:    "participant_response_slot_count",
		Help:    "Number of slots submitted per participant response",
		Buckets: []float64{0, 1, 2, 3, 5, 8, 13, 21},
	})

	registry.MustRegister(created, httpReq, viewDuration, cacheRatio, participantJoin, responseSubmission, responseSlots)

	return &Prometheus{
		registry:                    registry,
		appointmentsCreated:         created,
		httpRequests:                httpReq,
		viewDuration:                viewDuration,
		templateCacheHitRatio:       cacheRatio,
		participantJoinDuration:     participantJoin,
		responseSubmissionDuration:  responseSubmission,
		responseSubmissionSlotCount: responseSlots,
	}
}

func (p *Prometheus) IncrementAppointmentsCreated(templateID string) {
	p.appointmentsCreated.WithLabelValues(templateID).Inc()
}

func (p *Prometheus) RecordHTTPRequest(route string, statusCode int) {
	p.httpRequests.WithLabelValues(route, strconv.Itoa(statusCode)).Inc()
}

func (p *Prometheus) ObserveAppointmentViewDuration(durationMs float64, cacheHit bool) {
	label := "false"
	if cacheHit {
		label = "true"
	}
	p.viewDuration.WithLabelValues(label).Observe(durationMs)
}

func (p *Prometheus) UpdateTemplateCacheHitRatio(ratio float64) {
	p.templateCacheHitRatio.Set(ratio)
}

func (p *Prometheus) ObserveParticipantJoin(durationMs float64) {
	p.participantJoinDuration.Observe(durationMs)
}

func (p *Prometheus) ObserveResponseSubmission(durationMs float64, slotCount int) {
	p.responseSubmissionDuration.Observe(durationMs)
	p.responseSubmissionSlotCount.Observe(float64(slotCount))
}

func (p *Prometheus) Registry() *prometheus.Registry { return p.registry }

func (p *Prometheus) Reset() {
	p.appointmentsCreated.Reset()
	p.httpRequests.Reset()
	p.viewDuration.Reset()
}
