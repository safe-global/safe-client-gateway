import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';

describe('FakeConfigurationService', () => {
  let configurationService: FakeConfigurationService;

  beforeEach(() => {
    configurationService = new FakeConfigurationService();
  });

  it(`Setting key should store its value`, () => {
    configurationService.set('aaa', 'bbb');

    const result = configurationService.get('aaa');

    expect(configurationService.keyCount()).toBe(1);
    expect(result).toBe('bbb');
  });

  it(`Retrieving unknown key should return undefined`, () => {
    configurationService.set('aaa', 'bbb');

    const result = configurationService.get('unknown_key');

    expect(result).toBe(undefined);
  });

  it(`Retrieving unknown key should throw`, () => {
    configurationService.set('aaa', 'bbb');

    const result = (): void => {
      configurationService.getOrThrow('unknown_key');
    };

    expect(result).toThrow(Error('No value set for key unknown_key'));
  });
});
