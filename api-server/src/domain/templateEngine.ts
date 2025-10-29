export type SlotRule = {
  slotInstanceId: string;
  label: string;
};

export type TemplateDefinition = {
  id: string;
  name: string;
  rules: SlotRule[];
};

export class TemplateEngine {
  constructor(private readonly template: TemplateDefinition) {}

  public generateSlots() {
    return this.template.rules.map((rule) => ({
      slotInstanceId: rule.slotInstanceId,
      label: rule.label
    }));
  }
}

export const demoTemplate: TemplateDefinition = {
  id: 'demo-default',
  name: 'Demo Template',
  rules: [
    { slotInstanceId: '2024-05-01_dinner', label: 'May 1st – Dinner' },
    { slotInstanceId: '2024-05-02_lunch', label: 'May 2nd – Lunch' }
  ]
};
