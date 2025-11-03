import { ShareUrlBuilder } from '../../src/domain/shareUrlBuilder';

describe('ShareUrlBuilder', () => {
  it('builds relative paths', () => {
    const builder = new ShareUrlBuilder();
    const url = builder.buildRelativePath('1234');

    expect(url).toBe('/appointments/1234');
  });
});
