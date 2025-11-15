// Implemented for spec: agent/specs/meal-appointment-view-appointment-backend-implementation-spec.md

import type { TemplateRecord } from './templateRepository';

export interface TemplateCacheMetrics {
  updateTemplateCacheHitRatio(hitRatio: number): void;
}

interface CacheEntry {
  value: TemplateRecord;
  expiresAt: number;
}

export class InMemoryTemplateCache {
  private readonly entries = new Map<string, CacheEntry>();
  private hits = 0;
  private misses = 0;

  constructor(
    private readonly ttlMs: number,
    private readonly metrics: TemplateCacheMetrics,
    private readonly now: () => number = () => Date.now()
  ) {}

  get(id: string): TemplateRecord | null {
    const entry = this.entries.get(id);
    if (entry && entry.expiresAt > this.now()) {
      this.hits += 1;
      this.emitRatio();
      return entry.value;
    }

    if (entry) {
      this.entries.delete(id);
    }

    this.misses += 1;
    this.emitRatio();
    return null;
  }

  set(id: string, value: TemplateRecord): void {
    this.entries.set(id, { value, expiresAt: this.now() + this.ttlMs });
  }

  clear(): void {
    this.entries.clear();
    this.hits = 0;
    this.misses = 0;
    this.emitRatio();
  }

  private emitRatio(): void {
    const total = this.hits + this.misses;
    const ratio = total === 0 ? 0 : this.hits / total;
    this.metrics.updateTemplateCacheHitRatio(ratio);
  }
}
