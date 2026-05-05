// SPDX-License-Identifier: FSL-1.1-MIT
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { PasskeysModule } from '@/modules/passkeys/passkeys.module';

function buildConfig(
  overrides: Partial<{
    rpIdAllowlist: ReadonlyArray<string>;
    originAllowlist: ReadonlyArray<string>;
    verifiersAllowlist: ReadonlyArray<string>;
  }> = {},
): IConfigurationService {
  const values: Record<string, ReadonlyArray<string>> = {
    'passkeys.rpIdAllowlist': overrides.rpIdAllowlist ?? ['app.safe.global'],
    'passkeys.originAllowlist': overrides.originAllowlist ?? [
      'https://app.safe.global',
    ],
    'passkeys.verifiersAllowlist': overrides.verifiersAllowlist ?? [
      `0x${'0'.repeat(44)}`,
    ],
  };
  return {
    get: jest.fn(),
    getOrThrow: jest.fn((key: string) => {
      if (!(key in values)) {
        throw new Error(`Unexpected key in test: ${key}`);
      }
      return values[key];
    }),
  } as unknown as IConfigurationService;
}

describe('PasskeysModule', () => {
  it('boots when all three allowlists are non-empty', () => {
    const module = new PasskeysModule(buildConfig());
    expect(() => module.onModuleInit()).not.toThrow();
  });

  it.each([
    ['rpIdAllowlist'],
    ['originAllowlist'],
    ['verifiersAllowlist'],
  ] as const)('throws when %s is empty', (which) => {
    const module = new PasskeysModule(buildConfig({ [which]: [] }));
    expect(() => module.onModuleInit()).toThrow(/must be non-empty/);
  });
});
