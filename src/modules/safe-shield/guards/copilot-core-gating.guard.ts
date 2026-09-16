// SPDX-License-Identifier: FSL-1.1-MIT
import { type CanActivate, Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CopilotCoreDisabledError } from '@/modules/safe-shield/errors/copilot-core-disabled.error';

/** Rejects a Core recipient/counterparty analysis request with a typed 402. */
@Injectable()
export class CopilotCoreGatingGuard implements CanActivate {
  public constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {}

  public canActivate(): boolean {
    const disabled = this.configurationService.getOrThrow<boolean>(
      'features.copilotCoreDisabled',
    );
    if (disabled) {
      throw new CopilotCoreDisabledError();
    }
    return true;
  }
}
