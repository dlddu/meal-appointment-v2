import { TemplateEngine, demoTemplate } from '../../src/domain/templateEngine';

describe('TemplateEngine', () => {
  it('should map rules into slot DTOs', () => {
    const engine = new TemplateEngine(demoTemplate);
    const result = engine.generateSlots();

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ slotInstanceId: '2024-05-01_dinner', label: 'May 1st – Dinner' });
  });
});
