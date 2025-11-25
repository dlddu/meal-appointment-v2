// Implemented for spec: agent/specs/meal-appointment-participation-backend-implementation-spec.md

import type { Logger } from 'pino';
import type { TemplateCache } from '../appointments/viewAppointment.service';
import type { TemplateRepository, TemplateRule } from '../../infrastructure/templates/templateRepository';
import { TemplateParsingError } from '../../infrastructure/templates/templateRepository';
import { ServiceUnavailableApplicationError } from '../errors';

const slotKeyPattern = /^(\d{4}-\d{2}-\d{2})#([A-Z]+)$/;

export class SlotValidationHelper {
  constructor(private readonly rules: TemplateRule[]) {}

  isValid(slotKey: string): boolean {
    const match = slotKeyPattern.exec(slotKey);
    if (!match) {
      return false;
    }

    const [, datePart, mealType] = match;
    const date = new Date(`${datePart}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) {
      return false;
    }

    const day = date.getUTCDay();
    return this.rules.some((rule) => this.matchesRule(rule, datePart, day, mealType));
  }

  private matchesRule(rule: TemplateRule, datePart: string, day: number, mealType: string): boolean {
    if (!rule.mealTypes.includes(mealType)) {
      return false;
    }

    if (rule.dayPattern === 'WEEKDAY') {
      return day >= 1 && day <= 5;
    }

    if (rule.dayPattern === 'WEEKEND') {
      return day === 0 || day === 6;
    }

    if (rule.dayPattern === 'EVERYDAY') {
      return true;
    }

    return rule.dayPattern === datePart;
  }
}

export interface TemplateValidationContext {
  requestId?: string;
}

export class TimeSlotTemplateService {
  constructor(
    private readonly templateRepository: TemplateRepository,
    private readonly templateCache: TemplateCache,
    private readonly logger: Logger
  ) {}

  async buildValidator(templateId: string, context: TemplateValidationContext): Promise<SlotValidationHelper> {
    const template = await this.loadTemplate(templateId, context);
    return new SlotValidationHelper(template.rules);
  }

  private async loadTemplate(templateId: string, context: TemplateValidationContext) {
    const cached = this.templateCache.get(templateId);
    if (cached) {
      return cached;
    }

    try {
      const template = await this.templateRepository.findById(templateId);
      if (!template) {
        throw new ServiceUnavailableApplicationError();
      }
      this.templateCache.set(templateId, template);
      return template;
    } catch (error) {
      this.logger.error(
        { event: 'template.load_failed', templateId, requestId: context.requestId, err: error },
        'Failed to load template for validation'
      );
      if (error instanceof TemplateParsingError) {
        throw new ServiceUnavailableApplicationError();
      }
      throw new ServiceUnavailableApplicationError();
    }
  }
}
