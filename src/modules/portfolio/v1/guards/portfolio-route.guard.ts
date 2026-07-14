// SPDX-License-Identifier: FSL-1.1-MIT
import { type CanActivate, Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';

/**
 * Gates the portfolio routes behind the Zerion kill-switch. The portfolio
 * endpoint is backed by Zerion, so it shares the same feature flag.
 */
@Injectable()
export class PortfolioRouteGuard implements CanActivate {
  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {}

  canActivate(): boolean {
    return this.configurationService.getOrThrow<boolean>('features.zerion');
  }
}
