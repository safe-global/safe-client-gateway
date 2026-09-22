// SPDX-License-Identifier: FSL-1.1-MIT
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { CopilotCoreDisabledError } from '@/modules/safe-shield/domain/errors/copilot-core-disabled.error';
import { CopilotCoreGatingGuard } from '@/modules/safe-shield/routes/guards/copilot-core-gating.guard';

describe('CopilotCoreGatingGuard', () => {
  function target(disabled: boolean): CopilotCoreGatingGuard {
    const configurationService = new FakeConfigurationService();
    configurationService.set('features.copilotCoreDisabled', disabled);
    return new CopilotCoreGatingGuard(configurationService);
  }

  it('rejects with a typed 402 when Copilot Core is disabled', () => {
    expect(() => target(true).canActivate()).toThrow(CopilotCoreDisabledError);
  });

  it('admits the request when Copilot Core is enabled', () => {
    expect(target(false).canActivate()).toBe(true);
  });
});
