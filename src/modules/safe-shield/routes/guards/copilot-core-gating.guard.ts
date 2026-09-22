// SPDX-License-Identifier: FSL-1.1-MIT
import { type CanActivate, Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CopilotCoreDisabledError } from '@/modules/safe-shield/domain/errors/copilot-core-disabled.error';

/** Rejects a Core recipient/counterparty analysis request with a typed 402. */
@Injectable()
export class CopilotCoreGatingGuard implements CanActivate {
  private readonly disabled: boolean;

  public constructor(
    @Inject(IConfigurationService)
    configurationService: IConfigurationService,
  ) {
    this.disabled = configurationService.getOrThrow<boolean>(
      'features.copilotCoreDisabled',
    );
  }

  public canActivate(): boolean {
    if (this.disabled) {
      throw new CopilotCoreDisabledError();
    }
    return true;
  }
}
