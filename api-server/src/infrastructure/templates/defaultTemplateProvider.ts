// Implemented for spec: agent/specs/meal-appointment-create-appointment-backend-spec.md

import type { ActiveTemplateProvider } from '../../application/appointments/activeTemplateService';

export class DefaultActiveTemplateProvider implements ActiveTemplateProvider {
  async loadActiveTemplateIds(): Promise<string[]> {
    return ['default_weekly'];
  }
}
