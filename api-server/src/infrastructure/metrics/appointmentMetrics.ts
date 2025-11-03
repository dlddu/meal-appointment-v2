// Implemented for spec: agent/specs/meal-appointment-create-appointment-backend-spec.md

import { Counter, Registry } from 'prom-client';

export interface AppointmentMetrics {
  incrementAppointmentsCreated(templateId: string): void;
  getRegistry(): Registry;
  reset(): void;
}

export class PrometheusAppointmentMetrics implements AppointmentMetrics {
  private readonly registry: Registry;
  private readonly appointmentsCreatedCounter: Counter<'time_slot_template_id'>;

  constructor() {
    this.registry = new Registry();
    this.appointmentsCreatedCounter = new Counter({
      name: 'appointments_created_total',
      help: 'Number of appointments created',
      labelNames: ['time_slot_template_id'],
      registers: [this.registry]
    });
  }

  incrementAppointmentsCreated(templateId: string): void {
    this.appointmentsCreatedCounter.inc({ time_slot_template_id: templateId });
  }

  getRegistry(): Registry {
    return this.registry;
  }

  reset(): void {
    this.registry.resetMetrics();
  }
}
