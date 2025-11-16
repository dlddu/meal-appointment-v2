// Implemented for spec: agent/specs/meal-appointment-create-appointment-backend-spec.md
// Implemented for spec: agent/specs/meal-appointment-view-appointment-backend-implementation-spec.md

import { Counter, Gauge, Histogram, Registry } from 'prom-client';

export interface AppointmentMetrics {
  incrementAppointmentsCreated(templateId: string): void;
  recordHttpRequest(route: string, statusCode: number): void;
  observeAppointmentViewDuration(durationMs: number, cacheHit: boolean): void;
  updateTemplateCacheHitRatio(hitRatio: number): void;
  getRegistry(): Registry;
  reset(): void;
}

export class PrometheusAppointmentMetrics implements AppointmentMetrics {
  private readonly registry: Registry;
  private readonly appointmentsCreatedCounter: Counter<'time_slot_template_id'>;
  private readonly httpRequestsTotal: Counter<'route' | 'status_code'>;
  private readonly viewDurationHistogram: Histogram<'cache_hit'>;
  private readonly templateCacheHitRatioGauge: Gauge;

  constructor() {
    this.registry = new Registry();
    this.appointmentsCreatedCounter = new Counter({
      name: 'appointments_created_total',
      help: 'Number of appointments created',
      labelNames: ['time_slot_template_id'],
      registers: [this.registry]
    });

    this.httpRequestsTotal = new Counter({
      name: 'http_server_requests_total',
      help: 'Total HTTP requests processed',
      labelNames: ['route', 'status_code'],
      registers: [this.registry]
    });

    this.viewDurationHistogram = new Histogram({
      name: 'appointment_view_duration_ms',
      help: 'Duration of appointment view requests in milliseconds',
      buckets: [10, 50, 100, 250, 500, 1000, 2000],
      labelNames: ['cache_hit'],
      registers: [this.registry]
    });

    this.templateCacheHitRatioGauge = new Gauge({
      name: 'template_cache_hit_ratio',
      help: 'Ratio of template cache hits over total lookups',
      registers: [this.registry]
    });
  }

  incrementAppointmentsCreated(templateId: string): void {
    this.appointmentsCreatedCounter.inc({ time_slot_template_id: templateId });
  }

  recordHttpRequest(route: string, statusCode: number): void {
    this.httpRequestsTotal.inc({ route, status_code: String(statusCode) });
  }

  observeAppointmentViewDuration(durationMs: number, cacheHit: boolean): void {
    this.viewDurationHistogram.observe({ cache_hit: cacheHit ? 'true' : 'false' }, durationMs);
  }

  updateTemplateCacheHitRatio(hitRatio: number): void {
    this.templateCacheHitRatioGauge.set(hitRatio);
  }

  getRegistry(): Registry {
    return this.registry;
  }

  reset(): void {
    this.registry.resetMetrics();
  }
}
