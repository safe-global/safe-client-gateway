// SPDX-License-Identifier: FSL-1.1-MIT
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { SafeShieldCoreDisabledError } from '@/modules/safe-shield/domain/errors/safe-shield-core-disabled.error';
import { SafeShieldCoreGatingGuard } from '@/modules/safe-shield/routes/guards/safe-shield-core-gating.guard';

describe('SafeShieldCoreGatingGuard', () => {
  function target(disabled: boolean): SafeShieldCoreGatingGuard {
    const configurationService = new FakeConfigurationService();
    configurationService.set('features.safeShieldCoreDisabled', disabled);
    return new SafeShieldCoreGatingGuard(configurationService);
  }

  it('rejects with a typed 402 when Safe Shield Core is disabled', () => {
    expect(() => target(true).canActivate()).toThrow(
      SafeShieldCoreDisabledError,
    );
  });

  it('admits the request when Safe Shield Core is enabled', () => {
    expect(target(false).canActivate()).toBe(true);
  });
});
