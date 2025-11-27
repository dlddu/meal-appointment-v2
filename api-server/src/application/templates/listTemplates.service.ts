// Implemented for spec: agent/specs/meal-appointment-create-appointment-frontend-spec.md

import type { ActiveTemplateService } from '../appointments/activeTemplateService';
import type { TemplateRepository } from '../../infrastructure/templates/templateRepository';

export type TemplateListItem = {
  id: string;
  name: string;
  description: string | null;
  status: 'active' | 'inactive';
};

export class ListTemplatesService {
  constructor(
    private readonly templateRepository: TemplateRepository,
    private readonly activeTemplateService: ActiveTemplateService
  ) {}

  async execute(): Promise<TemplateListItem[]> {
    const [templates, activeIds] = await Promise.all([
      this.templateRepository.findAll(),
      this.activeTemplateService.getActiveTemplateIds()
    ]);

    const activeSet = new Set(activeIds);

    return templates.map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description,
      status: activeSet.has(template.id) ? 'active' : 'inactive'
    }));
  }
}
