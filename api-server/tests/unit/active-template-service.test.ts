import { ActiveTemplateService } from '../../src/application/appointments/activeTemplateService';

describe('ActiveTemplateService', () => {
  it('returns cached templates on successive calls', async () => {
    const loader = jest.fn().mockResolvedValue(['default_weekly']);
    const service = new ActiveTemplateService({ loadActiveTemplateIds: loader });

    const first = await service.getActiveTemplateIds();
    const second = await service.getActiveTemplateIds();

    expect(first).toEqual(['default_weekly']);
    expect(second).toEqual(['default_weekly']);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('reloads templates after TTL expires', async () => {
    const loader = jest.fn().mockResolvedValue(['default_weekly']);
    let currentTime = 0;
    const service = new ActiveTemplateService({ loadActiveTemplateIds: loader }, 5 * 60 * 1000, () => currentTime);

    await service.getActiveTemplateIds();
    currentTime = 5 * 60 * 1000 + 1;
    await service.getActiveTemplateIds();

    expect(loader).toHaveBeenCalledTimes(2);
  });
});
