// Implemented for spec: agent/specs/meal-appointment-create-appointment-backend-spec.md

import { ValidationApplicationError } from '../errors';

export interface ActiveTemplateProvider {
  loadActiveTemplateIds(): Promise<string[]>;
}

interface CacheEntry {
  value: string[];
  expiresAt: number;
}

export class ActiveTemplateService {
  private cache: CacheEntry | null = null;

  constructor(
    private readonly provider: ActiveTemplateProvider,
    private readonly ttlMs = 5 * 60 * 1000,
    private readonly now: () => number = () => Date.now()
  ) {}

  async getActiveTemplateIds(): Promise<string[]> {
    const current = this.now();
    if (this.cache && this.cache.expiresAt > current) {
      return this.cache.value;
    }

    const templates = await this.provider.loadActiveTemplateIds();
    this.cache = { value: templates, expiresAt: current + this.ttlMs };
    return templates;
  }

  async ensureTemplateIsActive(templateId: string): Promise<void> {
    const templates = await this.getActiveTemplateIds();
    if (!templates.includes(templateId)) {
      throw new ValidationApplicationError([
        { field: 'timeSlotTemplateId', message: 'Provided template is not active' }
      ]);
    }
  }

  invalidateCache(): void {
    this.cache = null;
  }
}
