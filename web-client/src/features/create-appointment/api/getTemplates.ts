// Implemented for spec: agent/specs/meal-appointment-create-appointment-frontend-spec.md

import { buildApiUrl } from '../../../utils/apiUrl.js';
import type { TemplateOption } from '../types.js';

export type TemplateListItem = {
  id: string;
  name: string;
  description?: string;
  status?: 'active' | 'inactive';
  badge?: string;
};

export type TemplateListResponse = {
  templates: TemplateListItem[];
};

export async function fetchTemplateOptions(apiBaseUrl: string): Promise<TemplateOption[]> {
  const url = buildApiUrl(apiBaseUrl, 'templates');
  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new Error('TEMPLATE_FETCH_FAILED');
  }

  if (!response.ok) {
    throw new Error('TEMPLATE_FETCH_FAILED');
  }

  const data = (await response.json()) as TemplateListResponse | TemplateListItem[];
  const list = Array.isArray((data as TemplateListResponse).templates)
    ? (data as TemplateListResponse).templates
    : (data as TemplateListItem[]);

  if (!Array.isArray(list)) {
    return [];
  }

  return list.map((template) => ({
    id: template.id,
    title: template.name,
    description: template.description ?? '',
    badge: template.badge,
    disabled: template.status === 'inactive' || template.badge === '준비 중'
  }));
}
