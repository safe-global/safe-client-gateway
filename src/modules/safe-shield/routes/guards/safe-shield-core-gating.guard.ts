// SPDX-License-Identifier: FSL-1.1-MIT
import { type CanActivate, Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { SafeShieldCoreDisabledError } from '@/modules/safe-shield/domain/errors/safe-shield-core-disabled.error';

/** Rejects a Core recipient/counterparty analysis request with a typed 402. */
@Injectable()
export class SafeShieldCoreGatingGuard implements CanActivate {
  private readonly disabled: boolean;

  public constructor(
    @Inject(IConfigurationService)
    configurationService: IConfigurationService,
  ) {
    this.disabled = configurationService.getOrThrow<boolean>(
      'features.safeShieldCoreDisabled',
    );
  }

  public canActivate(): boolean {
    if (this.disabled) {
      throw new SafeShieldCoreDisabledError();
    }
    return true;
  }
}
